use crate::domain::{
    AssistantContentBlock, ContentPart, MessageContent, ModelTarget, TokenizationPayload,
};
use blake3::Hasher;

/// Version of the streaming canonical payload encoding used for fingerprints.
pub(crate) const PAYLOAD_SCHEMA_VERSION: u32 = 3;
const PREVIEW_LIMIT: usize = 160;
const EXPANDED_PREVIEW_LIMIT: usize = 640;

#[derive(Debug, Clone)]
pub(crate) struct PayloadPreview {
    pub text: String,
    pub kind: &'static str,
    pub truncated: bool,
    pub expanded_text: String,
    pub expanded_truncated: bool,
}

#[derive(Debug, Clone)]
pub(crate) struct ProjectedPayload {
    pub text: String,
    pub partial: bool,
    pub unavailable: bool,
    pub note_codes: Vec<String>,
}

#[derive(Clone, Copy, Debug, Eq, Hash, PartialEq)]
pub(crate) struct PayloadFingerprint(pub(crate) blake3::Hash);

/// Fingerprint a payload without materialising a canonical string.
///
/// Every field is length-prefixed and every optional/vector value has an
/// explicit marker, so concatenated values cannot become ambiguous.
pub(crate) fn payload_fingerprint(payload: &TokenizationPayload) -> PayloadFingerprint {
    let mut hasher = Hasher::new();
    hash_u32(&mut hasher, PAYLOAD_SCHEMA_VERSION);
    hash_payload(&mut hasher, payload);
    PayloadFingerprint(hasher.finalize())
}

/// Hex is retained only as a test helper; the analysis hot path keeps
/// `PayloadFingerprint` as a fixed-size in-memory key.
#[cfg(test)]
pub(crate) fn payload_hash(payload: &TokenizationPayload) -> String {
    payload_fingerprint(payload).0.to_hex().to_string()
}

pub(crate) fn preview_payload(payload: &TokenizationPayload) -> PayloadPreview {
    match payload {
        TokenizationPayload::UserMessage(content) => preview_content(content),
        TokenizationPayload::AssistantMessage { blocks, .. } => {
            let mut builder = PreviewBuilder::new();
            let mut has_image = false;
            let mut has_tool_call = false;
            let mut tool_call_count = 0;
            let mut first_tool_call_preview = None;
            let mut has_non_image_content = false;
            let mut has_non_tool_content = false;
            for block in blocks {
                match block {
                    AssistantContentBlock::Text(text)
                    | AssistantContentBlock::Thinking { text, .. } => {
                        has_non_image_content = true;
                        has_non_tool_content = true;
                        builder.feed_text(text);
                    }
                    AssistantContentBlock::ToolCall {
                        name, arguments, ..
                    } => {
                        has_tool_call = true;
                        has_non_image_content = true;
                        tool_call_count += 1;
                        builder.feed_inline(name);
                        builder.feed_space();
                        builder.feed_text(arguments);
                        if first_tool_call_preview.is_none() {
                            let mut first = PreviewBuilder::new();
                            first.feed_inline(name);
                            first.feed_space();
                            first.feed_text(arguments);
                            first_tool_call_preview = Some(first);
                        }
                    }
                    AssistantContentBlock::Image(image) => {
                        has_image = true;
                        has_non_tool_content = true;
                        builder.feed_text(&image_preview(image));
                    }
                    AssistantContentBlock::Unsupported => {
                        has_non_tool_content = true;
                        builder.feed_text("[unsupported content]");
                    }
                }
            }
            if !has_image && !has_tool_call && !has_non_image_content && has_non_tool_content {
                return bounded_preview("Content unavailable", "unavailable");
            }
            let mut preview = builder.finish(if has_tool_call {
                "toolCall"
            } else if has_image && !has_non_image_content {
                "image"
            } else {
                "text"
            });
            if let Some(first_tool_call) = first_tool_call_preview {
                let first_tool_call = first_tool_call.finish("toolCall");
                preview.text = first_tool_call.text;
                preview.truncated = preview.truncated
                    || first_tool_call.truncated
                    || has_non_tool_content
                    || tool_call_count > 1;
            }
            preview
        }
        TokenizationPayload::ToolResult {
            tool_name,
            content,
            is_error,
            ..
        } => {
            let mut builder = PreviewBuilder::new();
            builder.feed_inline(tool_name);
            if *is_error {
                builder.feed_space();
                builder.feed_inline("[error]");
            }
            builder.feed_space();
            feed_content(&mut builder, content, true);
            builder.finish("toolResult")
        }
        TokenizationPayload::CustomMessage(content) => preview_content(content),
        TokenizationPayload::CompactionSummary(summary)
        | TokenizationPayload::BranchSummary(summary) => bounded_preview(summary, "summary"),
        TokenizationPayload::CommandExecution {
            command, output, ..
        } => {
            let mut builder = PreviewBuilder::new();
            builder.feed_inline("$ ");
            builder.feed_inline(command);
            builder.feed_text(output);
            builder.finish("text")
        }
        TokenizationPayload::Unavailable => PayloadPreview {
            text: "Content unavailable".into(),
            kind: "unavailable",
            truncated: false,
            expanded_text: "Content unavailable".into(),
            expanded_truncated: false,
        },
    }
}

fn preview_content(content: &MessageContent) -> PayloadPreview {
    let has_image = content
        .parts
        .iter()
        .any(|part| matches!(part, ContentPart::Image(_)));
    let has_non_image_content = content
        .parts
        .iter()
        .any(|part| matches!(part, ContentPart::Text(_)));
    let has_unsupported = content
        .parts
        .iter()
        .any(|part| matches!(part, ContentPart::Unsupported));
    if has_unsupported && !has_image && !has_non_image_content {
        return bounded_preview("Content unavailable", "unavailable");
    }
    let mut builder = PreviewBuilder::new();
    feed_content(&mut builder, content, false);
    builder.finish(if has_image && !has_non_image_content && !has_unsupported {
        "image"
    } else {
        "text"
    })
}

fn feed_content(builder: &mut PreviewBuilder, content: &MessageContent, inline_first: bool) {
    if content.parts.is_empty() {
        builder.finish_line();
        return;
    }
    for (index, part) in content.parts.iter().enumerate() {
        if index > 0 || !inline_first {
            builder.finish_line();
        }
        match part {
            ContentPart::Text(text) => builder.feed_inline(text),
            ContentPart::Image(image) => builder.feed_inline(&image_preview(image)),
            ContentPart::Unsupported => builder.feed_inline("[unsupported content]"),
        }
        builder.finish_line();
    }
}

fn image_preview(image: &crate::domain::ImageDescriptor) -> String {
    let media_type = image.media_type.as_deref().unwrap_or("unknown");
    let Some(byte_length) = image.byte_length else {
        return format!("[image: {media_type}]");
    };
    let (size, unit) = if byte_length < 1024 {
        (byte_length as f64, "B")
    } else if byte_length < 1024 * 1024 {
        (byte_length as f64 / 1024.0, "KB")
    } else if byte_length < 1024 * 1024 * 1024 {
        (byte_length as f64 / (1024.0 * 1024.0), "MB")
    } else {
        (byte_length as f64 / (1024.0 * 1024.0 * 1024.0), "GB")
    };
    format!("[image: {media_type}, {size:.1} {unit}]")
}

fn bounded_preview(value: &str, kind: &'static str) -> PayloadPreview {
    let mut builder = PreviewBuilder::new();
    builder.feed_text(value);
    builder.finish(kind)
}

struct PreviewBuilder {
    current_line: String,
    current_line_scalars: usize,
    current_line_overflow: bool,
    compact: String,
    expanded: String,
    meaningful_lines: usize,
    compact_truncated: bool,
    expanded_truncated: bool,
    pending_whitespace: usize,
    line_has_content: bool,
}

impl PreviewBuilder {
    fn new() -> Self {
        Self {
            current_line: String::new(),
            current_line_scalars: 0,
            current_line_overflow: false,
            compact: String::new(),
            expanded: String::new(),
            meaningful_lines: 0,
            compact_truncated: false,
            expanded_truncated: false,
            pending_whitespace: 0,
            line_has_content: false,
        }
    }

    fn feed_text(&mut self, value: &str) {
        self.feed_inline(value);
        self.finish_line();
    }

    fn feed_inline(&mut self, value: &str) {
        for character in value.chars() {
            if character == '\n' {
                self.finish_line();
            } else if character.is_control() && character != '\t' {
                continue;
            } else if character.is_whitespace() {
                if self.line_has_content {
                    self.pending_whitespace = self.pending_whitespace.saturating_add(1);
                }
            } else {
                self.line_has_content = true;
                self.flush_pending_whitespace();
                self.push_scalar(character);
            }
        }
    }

    fn feed_space(&mut self) {
        if self.line_has_content {
            self.pending_whitespace = self.pending_whitespace.saturating_add(1);
        }
    }

    fn flush_pending_whitespace(&mut self) {
        let pending = std::mem::take(&mut self.pending_whitespace);
        let available = (EXPANDED_PREVIEW_LIMIT + 1).saturating_sub(self.current_line_scalars);
        for _ in 0..pending.min(available) {
            self.push_scalar(' ');
        }
        if pending > available {
            self.current_line_overflow = true;
        }
    }

    fn push_scalar(&mut self, character: char) {
        if self.current_line_scalars < EXPANDED_PREVIEW_LIMIT + 1 {
            self.current_line.push(character);
            self.current_line_scalars += 1;
        } else {
            self.current_line_overflow = true;
        }
    }

    fn finish_line(&mut self) {
        if !self.line_has_content {
            self.pending_whitespace = 0;
            return;
        }
        self.meaningful_lines += 1;
        if self.meaningful_lines == 1 {
            self.compact = take_scalars(&self.current_line, PREVIEW_LIMIT);
            self.compact_truncated =
                self.current_line_overflow || self.current_line_scalars > PREVIEW_LIMIT;
        } else {
            self.compact_truncated = true;
        }

        if self.meaningful_lines > 1 {
            if self.expanded.chars().count() < EXPANDED_PREVIEW_LIMIT {
                self.expanded.push('\n');
            } else {
                self.expanded_truncated = true;
            }
        }
        let remaining = EXPANDED_PREVIEW_LIMIT.saturating_sub(self.expanded.chars().count());
        self.expanded
            .extend(self.current_line.chars().take(remaining));
        if self.current_line_overflow || self.current_line_scalars > remaining {
            self.expanded_truncated = true;
        }
        self.current_line.clear();
        self.current_line_scalars = 0;
        self.current_line_overflow = false;
        self.pending_whitespace = 0;
        self.line_has_content = false;
    }

    fn finish(mut self, kind: &'static str) -> PayloadPreview {
        self.finish_line();
        if self.meaningful_lines == 0 {
            return PayloadPreview {
                text: "Content unavailable".into(),
                kind,
                truncated: false,
                expanded_text: "Content unavailable".into(),
                expanded_truncated: false,
            };
        }
        PayloadPreview {
            text: self.compact,
            kind,
            truncated: self.compact_truncated,
            expanded_text: self.expanded,
            expanded_truncated: self.expanded_truncated,
        }
    }
}

fn take_scalars(value: &str, limit: usize) -> String {
    value.chars().take(limit).collect()
}

pub(crate) fn project_payload(
    payload: &TokenizationPayload,
    target: &ModelTarget,
) -> ProjectedPayload {
    let mut notes = Vec::new();
    let (text, partial, unavailable) = match payload {
        TokenizationPayload::UserMessage(content) => {
            let (text, partial, unavailable) = project_content(content, &mut notes);
            (text, partial, unavailable)
        }
        TokenizationPayload::AssistantMessage {
            blocks,
            source_provider,
            source_model,
            source_api,
        } => {
            let source_matches = source_provider.as_deref() == target.provider.as_deref()
                && source_model.as_deref() == target.model.as_deref()
                && source_api.as_deref() == target.api.as_deref();
            let mut out = String::new();
            let mut partial = false;
            let mut has_supported = false;
            let mut has_unsupported = false;
            for block in blocks {
                match block {
                    AssistantContentBlock::Text(value) => {
                        has_supported = true;
                        append_part(&mut out, value);
                    }
                    AssistantContentBlock::Thinking { text, .. } => {
                        has_supported = true;
                        if source_matches || source_model.is_none() {
                            append_part(&mut out, text);
                        } else {
                            notes.push("modelSwitchTransformation".into());
                            partial = true;
                        }
                    }
                    AssistantContentBlock::ToolCall {
                        name, arguments, ..
                    } => {
                        has_supported = true;
                        append_part(&mut out, name);
                        append_part(&mut out, arguments);
                    }
                    AssistantContentBlock::Image(image) => {
                        has_supported = true;
                        append_part(&mut out, "[image]");
                        notes.push("unsupportedImage".into());
                        let _ = image;
                        partial = true;
                    }
                    AssistantContentBlock::Unsupported => {
                        has_unsupported = true;
                        notes.push("unsupportedPayload".into());
                        partial = true;
                    }
                }
            }
            (out, partial, has_unsupported && !has_supported)
        }
        TokenizationPayload::ToolResult {
            tool_call_id,
            tool_name,
            content,
            is_error,
        } => {
            let mut out = String::new();
            append_part(&mut out, tool_call_id);
            append_part(&mut out, tool_name);
            if *is_error {
                append_part(&mut out, "[error]");
            }
            let (content_text, partial, unavailable) = project_content(content, &mut notes);
            append_part(&mut out, &content_text);
            (out, partial, unavailable)
        }
        TokenizationPayload::CustomMessage(content) => {
            let (text, partial, unavailable) = project_content(content, &mut notes);
            (text, partial, unavailable)
        }
        TokenizationPayload::CompactionSummary(summary) => (summary.clone(), false, false),
        TokenizationPayload::BranchSummary(summary) => (summary.clone(), false, false),
        TokenizationPayload::CommandExecution {
            command,
            output,
            excluded_from_context,
        } => {
            if *excluded_from_context {
                notes.push("excludedFromContext".into());
                (String::new(), false, false)
            } else {
                (format!("{command}\n{output}"), false, false)
            }
        }
        TokenizationPayload::Unavailable => {
            notes.push("unavailablePayload".into());
            (String::new(), false, true)
        }
    };
    notes.sort();
    notes.dedup();
    ProjectedPayload {
        text,
        partial,
        unavailable,
        note_codes: notes,
    }
}

fn project_content(content: &MessageContent, notes: &mut Vec<String>) -> (String, bool, bool) {
    let mut output = String::new();
    let mut partial = false;
    let mut has_supported = false;
    let mut has_unsupported = false;
    for part in &content.parts {
        match part {
            ContentPart::Text(text) => {
                has_supported = true;
                append_part(&mut output, text);
            }
            ContentPart::Image(image) => {
                has_supported = true;
                append_part(&mut output, "[image]");
                let _ = image;
                notes.push("unsupportedImage".into());
                partial = true;
            }
            ContentPart::Unsupported => {
                has_unsupported = true;
                notes.push("unsupportedPayload".into());
                partial = true;
            }
        }
    }
    (output, partial, has_unsupported && !has_supported)
}

fn append_part(output: &mut String, value: &str) {
    if !output.is_empty() {
        output.push('\n');
    }
    output.push_str(value);
}

fn hash_payload(hasher: &mut Hasher, payload: &TokenizationPayload) {
    match payload {
        TokenizationPayload::UserMessage(content) => {
            hash_tag(hasher, b"user");
            hash_content(hasher, content);
        }
        TokenizationPayload::AssistantMessage {
            blocks,
            source_provider,
            source_model,
            source_api,
        } => {
            hash_tag(hasher, b"assistant");
            hash_optional_string(hasher, b"source-provider", source_provider.as_deref());
            hash_optional_string(hasher, b"source-model", source_model.as_deref());
            hash_optional_string(hasher, b"source-api", source_api.as_deref());
            hash_u64(hasher, blocks.len() as u64);
            for block in blocks {
                hash_assistant_block(hasher, block);
            }
        }
        TokenizationPayload::ToolResult {
            tool_call_id,
            tool_name,
            content,
            is_error,
        } => {
            hash_tag(hasher, b"tool-result");
            hash_string(hasher, b"tool-call-id", tool_call_id);
            hash_string(hasher, b"tool-name", tool_name);
            hash_bool(hasher, b"is-error", *is_error);
            hash_content(hasher, content);
        }
        TokenizationPayload::CustomMessage(content) => {
            hash_tag(hasher, b"custom");
            hash_content(hasher, content);
        }
        TokenizationPayload::CompactionSummary(summary) => {
            hash_tag(hasher, b"compaction");
            hash_string(hasher, b"summary", summary);
        }
        TokenizationPayload::BranchSummary(summary) => {
            hash_tag(hasher, b"branch");
            hash_string(hasher, b"summary", summary);
        }
        TokenizationPayload::CommandExecution {
            command,
            output,
            excluded_from_context,
        } => {
            hash_tag(hasher, b"command");
            hash_string(hasher, b"command", command);
            hash_string(hasher, b"output", output);
            hash_bool(hasher, b"excluded-from-context", *excluded_from_context);
        }
        TokenizationPayload::Unavailable => hash_tag(hasher, b"unavailable"),
    }
}

fn hash_content(hasher: &mut Hasher, content: &MessageContent) {
    hash_tag(hasher, b"content");
    hash_u64(hasher, content.parts.len() as u64);
    for part in &content.parts {
        match part {
            ContentPart::Text(text) => {
                hash_tag(hasher, b"text");
                hash_string(hasher, b"value", text);
            }
            ContentPart::Image(image) => {
                hash_tag(hasher, b"image");
                hash_image(hasher, image);
            }
            ContentPart::Unsupported => hash_tag(hasher, b"unsupported"),
        }
    }
}

fn hash_assistant_block(hasher: &mut Hasher, block: &AssistantContentBlock) {
    match block {
        AssistantContentBlock::Text(text) => {
            hash_tag(hasher, b"text");
            hash_string(hasher, b"value", text);
        }
        AssistantContentBlock::Thinking {
            text,
            provider_signature,
        } => {
            hash_tag(hasher, b"thinking");
            hash_string(hasher, b"text", text);
            hash_optional_string(hasher, b"provider-signature", provider_signature.as_deref());
        }
        AssistantContentBlock::ToolCall {
            id,
            name,
            arguments,
        } => {
            hash_tag(hasher, b"tool-call");
            hash_string(hasher, b"id", id);
            hash_string(hasher, b"name", name);
            hash_string(hasher, b"arguments", arguments);
        }
        AssistantContentBlock::Image(image) => {
            hash_tag(hasher, b"image");
            hash_image(hasher, image);
        }
        AssistantContentBlock::Unsupported => hash_tag(hasher, b"unsupported"),
    }
}

fn hash_image(hasher: &mut Hasher, image: &crate::domain::ImageDescriptor) {
    hash_optional_string(hasher, b"media-type", image.media_type.as_deref());
    match image.byte_length {
        Some(value) => {
            hasher.update(b"byte-length");
            hasher.update(&[1]);
            hash_u64(hasher, value);
        }
        None => {
            hasher.update(b"byte-length");
            hasher.update(&[0]);
        }
    }
}

fn hash_tag(hasher: &mut Hasher, tag: &[u8]) {
    hash_bytes(hasher, b"tag", tag);
}

fn hash_string(hasher: &mut Hasher, field: &[u8], value: &str) {
    hash_bytes(hasher, field, value.as_bytes());
}

fn hash_optional_string(hasher: &mut Hasher, field: &[u8], value: Option<&str>) {
    hasher.update(field);
    match value {
        Some(value) => {
            hasher.update(&[1]);
            hash_u64(hasher, value.len() as u64);
            hasher.update(value.as_bytes());
        }
        None => {
            hasher.update(&[0]);
        }
    }
}

fn hash_bytes(hasher: &mut Hasher, field: &[u8], value: &[u8]) {
    hasher.update(field);
    hash_u64(hasher, value.len() as u64);
    hasher.update(value);
}

fn hash_bool(hasher: &mut Hasher, field: &[u8], value: bool) {
    hasher.update(field);
    hasher.update(&[u8::from(value)]);
}

fn hash_u32(hasher: &mut Hasher, value: u32) {
    hasher.update(&value.to_le_bytes());
}

fn hash_u64(hasher: &mut Hasher, value: u64) {
    hasher.update(&value.to_le_bytes());
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::{ContentPart, ImageDescriptor};

    #[test]
    fn payload_hash_is_deterministic_and_does_not_expose_content_in_hash() {
        let first = TokenizationPayload::UserMessage(MessageContent {
            parts: vec![ContentPart::Text("secret".into())],
        });
        let second = TokenizationPayload::UserMessage(MessageContent {
            parts: vec![ContentPart::Text("secret".into())],
        });
        assert_eq!(payload_hash(&first), payload_hash(&second));
        assert!(!payload_hash(&first).contains("secret"));
    }

    #[test]
    fn streaming_fingerprints_preserve_variant_and_optional_boundaries() {
        let text = |value: &str| {
            TokenizationPayload::UserMessage(MessageContent {
                parts: vec![ContentPart::Text(value.into())],
            })
        };
        assert_ne!(
            payload_fingerprint(&text("ab")),
            payload_fingerprint(&text("a"))
        );
        assert_ne!(
            payload_fingerprint(&TokenizationPayload::Unavailable),
            payload_fingerprint(&text("unavailable")),
        );
        let empty = TokenizationPayload::UserMessage(MessageContent::empty());
        assert_ne!(payload_fingerprint(&empty), payload_fingerprint(&text("")));
    }

    #[test]
    fn source_model_metadata_is_part_of_the_fingerprint() {
        let first = TokenizationPayload::AssistantMessage {
            blocks: vec![AssistantContentBlock::Thinking {
                text: "plan".into(),
                provider_signature: None,
            }],
            source_provider: Some("provider".into()),
            source_model: Some("model-a".into()),
            source_api: None,
        };
        let mut second = first.clone();
        if let TokenizationPayload::AssistantMessage { source_model, .. } = &mut second {
            *source_model = Some("model-b".into());
        }
        assert_ne!(payload_fingerprint(&first), payload_fingerprint(&second));
    }

    #[test]
    fn images_are_explicitly_partial() {
        let payload = TokenizationPayload::UserMessage(MessageContent {
            parts: vec![ContentPart::Image(ImageDescriptor {
                media_type: Some("image/png".into()),
                byte_length: Some(10),
            })],
        });
        let projected = project_payload(&payload, &ModelTarget::default());
        assert!(projected.partial);
        assert!(projected
            .note_codes
            .iter()
            .any(|code| code == "unsupportedImage"));
        assert_eq!(preview_payload(&payload).kind, "image");
    }

    #[test]
    fn unsupported_content_is_explicit_and_partial_when_mixed() {
        let mixed = TokenizationPayload::UserMessage(MessageContent {
            parts: vec![ContentPart::Text("known".into()), ContentPart::Unsupported],
        });
        let projected = project_payload(
            &mixed,
            &ModelTarget {
                provider: Some("openai".into()),
                model: Some("gpt-4o-mini".into()),
                api: Some("openai-chat-completions".into()),
            },
        );
        assert!(projected.partial);
        assert!(!projected.unavailable);
        assert!(projected
            .note_codes
            .iter()
            .any(|code| code == "unsupportedPayload"));
        assert!(preview_payload(&mixed).expanded_text.contains("known"));
        assert!(preview_payload(&mixed)
            .expanded_text
            .contains("unsupported content"));
    }

    #[test]
    fn unsupported_only_content_is_unavailable_not_zero_tokens() {
        let payload = TokenizationPayload::UserMessage(MessageContent {
            parts: vec![ContentPart::Unsupported],
        });
        let projected = project_payload(&payload, &ModelTarget::default());
        assert!(projected.unavailable);
        assert_eq!(projected.text, "");
        assert_eq!(preview_payload(&payload).kind, "unavailable");
    }

    #[test]
    fn empty_supported_content_remains_a_valid_empty_payload() {
        let payload = TokenizationPayload::UserMessage(MessageContent::empty());
        let projected = project_payload(&payload, &ModelTarget::default());
        assert!(!projected.partial);
        assert!(!projected.unavailable);
        assert_eq!(preview_payload(&payload).kind, "text");
    }

    #[test]
    fn mixed_assistant_preview_shows_the_tool_call_it_labels() {
        let payload = TokenizationPayload::AssistantMessage {
            blocks: vec![
                AssistantContentBlock::Thinking {
                    text: "planning".into(),
                    provider_signature: None,
                },
                AssistantContentBlock::ToolCall {
                    id: "call-1".into(),
                    name: "bash".into(),
                    arguments: "{\"command\":\"cargo test\"}".into(),
                },
                AssistantContentBlock::ToolCall {
                    id: "call-2".into(),
                    name: "python".into(),
                    arguments: "{\"script\":\"check.py\"}".into(),
                },
            ],
            source_provider: None,
            source_model: None,
            source_api: None,
        };
        let preview = preview_payload(&payload);
        assert_eq!(preview.kind, "toolCall");
        assert_eq!(preview.text, "bash {\"command\":\"cargo test\"}");
        assert_eq!(
            preview.expanded_text,
            "planning\nbash {\"command\":\"cargo test\"}\npython {\"script\":\"check.py\"}"
        );
        assert!(!preview.expanded_truncated);
        assert!(preview.truncated);
    }

    #[test]
    fn tool_result_previews_include_status_and_multiple_content_lines() {
        let payload = TokenizationPayload::ToolResult {
            tool_call_id: "call-1".into(),
            tool_name: "bash".into(),
            content: MessageContent {
                parts: vec![
                    ContentPart::Text("first result line".into()),
                    ContentPart::Text("second result line".into()),
                ],
            },
            is_error: true,
        };
        let preview = preview_payload(&payload);
        assert_eq!(preview.kind, "toolResult");
        assert_eq!(preview.text, "bash [error] first result line");
        assert_eq!(
            preview.expanded_text,
            "bash [error] first result line\nsecond result line"
        );
        assert!(!preview.expanded_truncated);
        assert!(preview.truncated);
    }

    #[test]
    fn image_previews_retain_available_metadata() {
        let payload = TokenizationPayload::UserMessage(MessageContent {
            parts: vec![ContentPart::Image(ImageDescriptor {
                media_type: Some("image/png".into()),
                byte_length: Some(24_900),
            })],
        });
        let preview = preview_payload(&payload);
        assert_eq!(preview.kind, "image");
        assert_eq!(preview.text, "[image: image/png, 24.3 KB]");
        assert_eq!(preview.expanded_text, preview.text);
        assert!(!preview.expanded_truncated);
    }

    #[test]
    fn unavailable_previews_remain_explicit_and_bounded() {
        let preview = preview_payload(&TokenizationPayload::Unavailable);
        assert_eq!(preview.kind, "unavailable");
        assert_eq!(preview.text, "Content unavailable");
        assert_eq!(preview.expanded_text, "Content unavailable");
        assert!(!preview.truncated);
        assert!(!preview.expanded_truncated);
    }

    #[test]
    fn previews_are_one_line_and_bounded() {
        let payload = TokenizationPayload::UserMessage(MessageContent::text(format!(
            "first line\n{}",
            "x".repeat(PREVIEW_LIMIT + 20)
        )));
        let preview = preview_payload(&payload);
        assert_eq!(preview.text, "first line");
        assert!(preview.truncated);
        assert_eq!(
            preview.expanded_text,
            format!("first line\n{}", "x".repeat(PREVIEW_LIMIT + 20))
        );
        assert!(!preview.expanded_truncated);
        assert!(preview.text.chars().count() <= PREVIEW_LIMIT);
    }

    #[test]
    fn expanded_previews_are_bounded_by_unicode_scalars() {
        let payload = TokenizationPayload::UserMessage(MessageContent::text(
            "🦀".repeat(EXPANDED_PREVIEW_LIMIT + 20),
        ));
        let preview = preview_payload(&payload);
        assert_eq!(
            preview.expanded_text.chars().count(),
            EXPANDED_PREVIEW_LIMIT
        );
        assert!(preview.expanded_truncated);
        assert_eq!(preview.text.chars().count(), PREVIEW_LIMIT);
        assert!(preview.truncated);
    }
}
