use crate::analysis::diagnostics::DiagnosticCode;
use crate::domain::{
    AssistantContentBlock, ContentPart, MessageContent, ModelTarget, TokenizationPayload,
};
use blake3::Hasher;

/// Version of the streaming canonical payload encoding used for fingerprints.
pub(crate) const PAYLOAD_SCHEMA_VERSION: u32 = 4;
const PREVIEW_LIMIT: usize = 160;
const EXPANDED_PREVIEW_LIMIT: usize = 640;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum PreviewKind {
    Text,
    Image,
    ToolCall,
    ToolResult,
    Summary,
    Unavailable,
}
impl PreviewKind {
    pub(in crate::analysis) fn as_str(self) -> &'static str {
        match self {
            Self::Text => "text",
            Self::Image => "image",
            Self::ToolCall => "toolCall",
            Self::ToolResult => "toolResult",
            Self::Summary => "summary",
            Self::Unavailable => "unavailable",
        }
    }
}

/// How a profile writes a payload out for counting.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct ProjectionRules {
    pub tool_calls: ToolCallRendering,
    pub images: ImageSizing,
}

impl ProjectionRules {
    pub(crate) const GENERIC: Self = Self {
        tool_calls: ToolCallRendering::NameAndArguments,
        images: ImageSizing::Placeholder,
    };
}

/// How an image is counted.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum ImageSizing {
    /// An `[image]` placeholder.
    Placeholder,
    /// Anthropic's rule: the image is scaled down to fit `long_edge` pixels on its longer
    /// side, then costs `width × height ÷ 750` tokens, at most `max_tokens`. An image whose
    /// size is unknown falls back to the placeholder.
    Claude { long_edge: u32, max_tokens: u64 },
}

/// How a tool call is written out for counting.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum ToolCallRendering {
    /// The tool's name and the arguments' JSON text.
    NameAndArguments,
    /// The form a Claude model reads: an `invoke` element with one `parameter` element per
    /// argument, string values written as they are rather than JSON-escaped. Measured against
    /// reported usage; see docs/data-semantics.md.
    ClaudeInvoke,
}

#[derive(Debug, Clone)]
pub(crate) struct PayloadPreview {
    pub text: String,
    pub kind: PreviewKind,
    pub truncated: bool,
    pub expanded_text: String,
    pub expanded_truncated: bool,
}

#[derive(Debug, Clone)]
pub(crate) struct ProjectedPayload {
    pub text: String,
    /// Tokens for images, counted from their size rather than from `text`.
    pub image_tokens: u64,
    pub partial: bool,
    pub unavailable: bool,
    pub note_codes: Vec<DiagnosticCode>,
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
                return bounded_preview("Content unavailable", PreviewKind::Unavailable);
            }
            let mut preview = builder.finish(if has_tool_call {
                PreviewKind::ToolCall
            } else if has_image && !has_non_image_content {
                PreviewKind::Image
            } else {
                PreviewKind::Text
            });
            if let Some(first_tool_call) = first_tool_call_preview {
                let first_tool_call = first_tool_call.finish(PreviewKind::ToolCall);
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
            builder.finish(PreviewKind::ToolResult)
        }
        TokenizationPayload::CustomMessage(content) => preview_content(content),
        TokenizationPayload::SystemPrompt { text, .. }
        | TokenizationPayload::ToolDefinition { text, .. } => {
            bounded_preview(text, PreviewKind::Text)
        }
        TokenizationPayload::CompactionSummary(summary)
        | TokenizationPayload::BranchSummary(summary) => {
            bounded_preview(summary, PreviewKind::Summary)
        }
        // Thinking has no readable text here: its content is the provider's encrypted
        // copy, and a recorded summary stays with the response item.
        TokenizationPayload::ReportedThinking { tokens, .. } => bounded_preview(
            &format!("{tokens} reasoning tokens reported for this response"),
            PreviewKind::Summary,
        ),
        TokenizationPayload::UnrecordedContext { tokens, .. } => bounded_preview(
            &format!(
                "{tokens} tokens of request content that the session does not record, measured as this call's reported input less its recorded items"
            ),
            PreviewKind::Summary,
        ),
        TokenizationPayload::CommandExecution {
            command, output, ..
        } => {
            let mut builder = PreviewBuilder::new();
            builder.feed_inline("$ ");
            builder.feed_inline(command);
            builder.feed_text(output);
            builder.finish(PreviewKind::Text)
        }
        TokenizationPayload::Unavailable => PayloadPreview {
            text: "Content unavailable".into(),
            kind: PreviewKind::Unavailable,
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
        .any(|part| matches!(part, ContentPart::Text(_) | ContentPart::ToolReference(_)));
    let has_unsupported = content
        .parts
        .iter()
        .any(|part| matches!(part, ContentPart::Unsupported));
    if has_unsupported && !has_image && !has_non_image_content {
        return bounded_preview("Content unavailable", PreviewKind::Unavailable);
    }
    let mut builder = PreviewBuilder::new();
    feed_content(&mut builder, content, false);
    builder.finish(if has_image && !has_non_image_content && !has_unsupported {
        PreviewKind::Image
    } else {
        PreviewKind::Text
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
            ContentPart::ToolReference(name) => builder.feed_inline(&tool_reference(name)),
            ContentPart::Unsupported => builder.feed_inline("[unsupported content]"),
        }
        builder.finish_line();
    }
}

fn image_preview(image: &crate::domain::ImageDescriptor) -> String {
    let media_type = image.media_type.as_deref().unwrap_or("unknown");
    let Some(encoded_data_length) = image.encoded_data_length else {
        return format!("[image: {media_type}]");
    };
    let (size, unit) = if encoded_data_length < 1024 {
        (encoded_data_length as f64, "B")
    } else if encoded_data_length < 1024 * 1024 {
        (encoded_data_length as f64 / 1024.0, "KB")
    } else if encoded_data_length < 1024 * 1024 * 1024 {
        (encoded_data_length as f64 / (1024.0 * 1024.0), "MB")
    } else {
        (
            encoded_data_length as f64 / (1024.0 * 1024.0 * 1024.0),
            "GB",
        )
    };
    format!("[image: {media_type}, {size:.1} {unit} encoded]")
}

fn bounded_preview(value: &str, kind: PreviewKind) -> PayloadPreview {
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

    fn finish(mut self, kind: PreviewKind) -> PayloadPreview {
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
    rules: ProjectionRules,
) -> ProjectedPayload {
    let ProjectionRules { tool_calls, images } = rules;
    let mut notes = Vec::new();
    let mut image_tokens = 0_u64;
    let (text, partial, unavailable) = match payload {
        TokenizationPayload::UserMessage(content) => {
            let (text, partial, unavailable) =
                project_content(content, images, &mut image_tokens, &mut notes);
            (text, partial, unavailable)
        }
        TokenizationPayload::AssistantMessage {
            blocks,
            source_provider,
            source_model,
            source_api,
            thinking_reported,
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
                    AssistantContentBlock::Thinking { .. } if *thinking_reported => {
                        has_supported = true;
                    }
                    AssistantContentBlock::Thinking { text, .. } => {
                        has_supported = true;
                        if source_matches || source_model.is_none() {
                            append_part(&mut out, text);
                        } else {
                            notes.push(DiagnosticCode::ModelSwitchTransformation);
                            partial = true;
                        }
                    }
                    AssistantContentBlock::ToolCall {
                        name, arguments, ..
                    } => {
                        has_supported = true;
                        match tool_calls {
                            ToolCallRendering::ClaudeInvoke => {
                                if let Some(invoke) = claude_invoke(name, arguments) {
                                    append_part(&mut out, &invoke);
                                } else {
                                    append_part(&mut out, name);
                                    append_part(&mut out, arguments);
                                }
                            }
                            ToolCallRendering::NameAndArguments => {
                                append_part(&mut out, name);
                                append_part(&mut out, arguments);
                            }
                        }
                    }
                    AssistantContentBlock::Image(image) => {
                        has_supported = true;
                        project_image(image, images, &mut out, &mut image_tokens, &mut notes);
                        partial = true;
                    }
                    AssistantContentBlock::Unsupported => {
                        has_unsupported = true;
                        notes.push(DiagnosticCode::UnsupportedPayload);
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
            let (content_text, partial, unavailable) =
                project_content(content, images, &mut image_tokens, &mut notes);
            append_part(&mut out, &content_text);
            (out, partial, unavailable)
        }
        TokenizationPayload::CustomMessage(content) => {
            let (text, partial, unavailable) =
                project_content(content, images, &mut image_tokens, &mut notes);
            (text, partial, unavailable)
        }
        TokenizationPayload::SystemPrompt { text, complete }
        | TokenizationPayload::ToolDefinition { text, complete } => {
            notes.push(DiagnosticCode::EstimatedProviderSerialization);
            if !complete {
                notes.push(DiagnosticCode::UnsupportedPayload);
            }
            (text.clone(), true, !complete)
        }
        TokenizationPayload::CompactionSummary(summary) => (summary.clone(), false, false),
        TokenizationPayload::BranchSummary(summary) => (summary.clone(), false, false),
        // Counted from the reported size by the registry, never from text.
        TokenizationPayload::ReportedThinking { .. }
        | TokenizationPayload::UnrecordedContext { .. } => (String::new(), false, false),
        TokenizationPayload::CommandExecution {
            command,
            output,
            excluded_from_context,
        } => {
            if *excluded_from_context {
                notes.push(DiagnosticCode::ExcludedFromContext);
                (String::new(), false, false)
            } else {
                (format!("{command}\n{output}"), false, false)
            }
        }
        TokenizationPayload::Unavailable => {
            notes.push(DiagnosticCode::UnavailablePayload);
            (String::new(), false, true)
        }
    };
    notes.sort();
    notes.dedup();
    ProjectedPayload {
        text,
        image_tokens,
        partial,
        unavailable,
        note_codes: notes,
    }
}

/// An image's tokens under Anthropic's sizing rule, or the `[image]` placeholder. Either way
/// the estimate is partial: the rule is documented, not measured per image.
fn project_image(
    image: &crate::domain::ImageDescriptor,
    sizing: ImageSizing,
    out: &mut String,
    image_tokens: &mut u64,
    notes: &mut Vec<DiagnosticCode>,
) {
    match (sizing, image.dimensions) {
        (
            ImageSizing::Claude {
                long_edge,
                max_tokens,
            },
            Some((width, height)),
        ) => {
            *image_tokens = image_tokens
                .saturating_add(claude_image_tokens(width, height, long_edge, max_tokens));
            notes.push(DiagnosticCode::EstimatedImageSize);
        }
        _ => {
            append_part(out, "[image]");
            notes.push(DiagnosticCode::UnsupportedImage);
        }
    }
}

fn claude_image_tokens(width: u32, height: u32, long_edge: u32, max_tokens: u64) -> u64 {
    let (width, height) = (f64::from(width), f64::from(height));
    let scale = (f64::from(long_edge) / width.max(height)).min(1.0);
    let tokens = (width * scale) * (height * scale) / 750.0;
    (tokens.ceil() as u64).min(max_tokens)
}

fn project_content(
    content: &MessageContent,
    images: ImageSizing,
    image_tokens: &mut u64,
    notes: &mut Vec<DiagnosticCode>,
) -> (String, bool, bool) {
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
                project_image(image, images, &mut output, image_tokens, notes);
                partial = true;
            }
            ContentPart::ToolReference(name) => {
                has_supported = true;
                append_part(&mut output, &tool_reference(name));
                notes.push(DiagnosticCode::UnrecordedToolDefinition);
                partial = true;
            }
            ContentPart::Unsupported => {
                has_unsupported = true;
                notes.push(DiagnosticCode::UnsupportedPayload);
                partial = true;
            }
        }
    }
    (output, partial, has_unsupported && !has_supported)
}

fn tool_reference(name: &str) -> String {
    format!("[tool reference: {name}]")
}

/// A tool call as Claude reads it, or `None` when the arguments are not a JSON object.
fn claude_invoke(name: &str, arguments: &str) -> Option<String> {
    let serde_json::Value::Object(arguments) = serde_json::from_str(arguments).ok()? else {
        return None;
    };
    let mut out = format!("<invoke name=\"{name}\">\n");
    for (key, value) in &arguments {
        out.push_str("<parameter name=\"");
        out.push_str(key);
        out.push_str("\">");
        match value {
            serde_json::Value::String(text) => out.push_str(text),
            other => out.push_str(&other.to_string()),
        }
        out.push_str("</parameter>\n");
    }
    out.push_str("</invoke>");
    Some(out)
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
            thinking_reported,
        } => {
            hash_tag(hasher, b"assistant");
            hash_optional_string(hasher, b"source-provider", source_provider.as_deref());
            hash_optional_string(hasher, b"source-model", source_model.as_deref());
            hash_optional_string(hasher, b"source-api", source_api.as_deref());
            hash_u64(hasher, blocks.len() as u64);
            for block in blocks {
                hash_assistant_block(hasher, block);
            }
            // Hashed only when set, so existing payloads keep their fingerprints.
            if *thinking_reported {
                hash_tag(hasher, b"thinking-reported");
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
        TokenizationPayload::SystemPrompt { text, complete } => {
            hash_tag(hasher, b"system-prompt");
            hash_string(hasher, b"text", text);
            hash_bool(hasher, b"complete", *complete);
        }
        TokenizationPayload::ToolDefinition { text, complete } => {
            hash_tag(hasher, b"tool-definition");
            hash_string(hasher, b"text", text);
            hash_bool(hasher, b"complete", *complete);
        }
        TokenizationPayload::CompactionSummary(summary) => {
            hash_tag(hasher, b"compaction");
            hash_string(hasher, b"summary", summary);
        }
        TokenizationPayload::BranchSummary(summary) => {
            hash_tag(hasher, b"branch");
            hash_string(hasher, b"summary", summary);
        }
        TokenizationPayload::ReportedThinking {
            tokens,
            source_model,
        } => {
            hash_tag(hasher, b"reported-thinking");
            hash_u64(hasher, *tokens);
            hash_optional_string(hasher, b"source-model", source_model.as_deref());
        }
        TokenizationPayload::UnrecordedContext {
            tokens,
            approximate,
        } => {
            hash_tag(hasher, b"unrecorded-context");
            hash_u64(hasher, *tokens);
            hash_u64(hasher, u64::from(*approximate));
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
            ContentPart::ToolReference(name) => {
                hash_tag(hasher, b"tool-reference");
                hash_string(hasher, b"name", name);
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
    // Hashed only when known, so images without a readable size keep their fingerprints.
    if let Some((width, height)) = image.dimensions {
        hash_tag(hasher, b"dimensions");
        hash_u64(hasher, u64::from(width));
        hash_u64(hasher, u64::from(height));
    }
    // Keep the historical tag: only the Rust field name changed; encoding is v3.
    match image.encoded_data_length {
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
            thinking_reported: false,
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
                encoded_data_length: Some(10),
                dimensions: None,
            })],
        });
        let projected =
            project_payload(&payload, &ModelTarget::default(), ProjectionRules::GENERIC);
        assert!(projected.partial);
        assert!(projected
            .note_codes
            .contains(&DiagnosticCode::UnsupportedImage));
        assert_eq!(preview_payload(&payload).kind, PreviewKind::Image);
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
            ProjectionRules::GENERIC,
        );
        assert!(projected.partial);
        assert!(!projected.unavailable);
        assert!(projected
            .note_codes
            .contains(&DiagnosticCode::UnsupportedPayload));
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
        let projected =
            project_payload(&payload, &ModelTarget::default(), ProjectionRules::GENERIC);
        assert!(projected.unavailable);
        assert_eq!(projected.text, "");
        assert_eq!(preview_payload(&payload).kind, PreviewKind::Unavailable);
    }

    #[test]
    fn empty_supported_content_remains_a_valid_empty_payload() {
        let payload = TokenizationPayload::UserMessage(MessageContent::empty());
        let projected =
            project_payload(&payload, &ModelTarget::default(), ProjectionRules::GENERIC);
        assert!(!projected.partial);
        assert!(!projected.unavailable);
        assert_eq!(preview_payload(&payload).kind, PreviewKind::Text);
    }

    #[test]
    fn claude_images_are_counted_from_their_size_after_scaling() {
        // Within the limits: width × height ÷ 750, rounded up.
        assert_eq!(claude_image_tokens(1000, 1000, 1568, 1600), 1334);
        assert_eq!(claude_image_tokens(200, 200, 1568, 1600), 54);
        // A long side over the limit is scaled down to it first.
        assert_eq!(claude_image_tokens(3136, 784, 1568, 1600), 820);
        // The token limit applies after that.
        assert_eq!(claude_image_tokens(1568, 1568, 1568, 1600), 1600);
        assert_eq!(claude_image_tokens(2576, 1449, 2576, 4784), 4784);
        assert_eq!(claude_image_tokens(1920, 1080, 2576, 4784), 2765);
    }

    #[test]
    fn claude_profiles_count_an_image_of_known_size_and_others_keep_the_placeholder() {
        let payload = TokenizationPayload::UserMessage(MessageContent {
            parts: vec![
                ContentPart::Text("Look.".into()),
                ContentPart::Image(ImageDescriptor {
                    media_type: Some("image/png".into()),
                    encoded_data_length: Some(1000),
                    dimensions: Some((1000, 1000)),
                }),
            ],
        });
        let claude = ProjectionRules {
            tool_calls: ToolCallRendering::ClaudeInvoke,
            images: ImageSizing::Claude {
                long_edge: 1568,
                max_tokens: 1600,
            },
        };
        let projected = project_payload(&payload, &ModelTarget::default(), claude);
        assert_eq!(projected.text, "Look.");
        assert_eq!(projected.image_tokens, 1334);
        assert!(projected.partial);
        assert_eq!(projected.note_codes, [DiagnosticCode::EstimatedImageSize]);
        let generic = project_payload(&payload, &ModelTarget::default(), ProjectionRules::GENERIC);
        assert_eq!(generic.text, "Look.\n[image]");
        assert_eq!(generic.image_tokens, 0);
        assert_eq!(generic.note_codes, [DiagnosticCode::UnsupportedImage]);
        let unknown_size = TokenizationPayload::UserMessage(MessageContent {
            parts: vec![ContentPart::Image(ImageDescriptor {
                media_type: None,
                encoded_data_length: None,
                dimensions: None,
            })],
        });
        let projected = project_payload(&unknown_size, &ModelTarget::default(), claude);
        assert_eq!(
            (projected.text.as_str(), projected.image_tokens),
            ("[image]", 0)
        );
    }

    #[test]
    fn tool_references_are_counted_as_a_partial_placeholder() {
        let payload = TokenizationPayload::ToolResult {
            tool_call_id: "call-1".into(),
            tool_name: "ToolSearch".into(),
            content: MessageContent {
                parts: vec![ContentPart::ToolReference("Read".into())],
            },
            is_error: false,
        };
        let projected =
            project_payload(&payload, &ModelTarget::default(), ProjectionRules::GENERIC);
        assert_eq!(projected.text, "call-1\nToolSearch\n[tool reference: Read]");
        assert!(projected.partial);
        assert!(!projected.unavailable);
        assert_eq!(
            projected.note_codes,
            [DiagnosticCode::UnrecordedToolDefinition]
        );
        assert_eq!(preview_payload(&payload).kind, PreviewKind::ToolResult);
    }

    #[test]
    fn claude_tool_calls_are_written_as_invoke_elements_with_unescaped_values() {
        let call = |arguments: &str| TokenizationPayload::AssistantMessage {
            blocks: vec![
                AssistantContentBlock::Text("Checking.".into()),
                AssistantContentBlock::ToolCall {
                    id: "call-1".into(),
                    name: "bash".into(),
                    arguments: arguments.into(),
                },
            ],
            source_provider: None,
            source_model: None,
            source_api: None,
            thinking_reported: false,
        };
        let object = call(r#"{"command":"echo \"hi\"\nls","timeout":5}"#);
        assert_eq!(
            project_payload(
                &object,
                &ModelTarget::default(),
                ProjectionRules {
                    tool_calls: ToolCallRendering::ClaudeInvoke,
                    images: ImageSizing::Placeholder,
                }
            )
            .text,
            "Checking.\n<invoke name=\"bash\">\n<parameter name=\"command\">echo \"hi\"\nls</parameter>\n<parameter name=\"timeout\">5</parameter>\n</invoke>"
        );
        assert_eq!(
            project_payload(&object, &ModelTarget::default(), ProjectionRules::GENERIC).text,
            "Checking.\nbash\n{\"command\":\"echo \\\"hi\\\"\\nls\",\"timeout\":5}"
        );
        // Arguments that are not a JSON object are counted as they were recorded.
        for arguments in ["[1, 2]", "not json"] {
            assert_eq!(
                project_payload(
                    &call(arguments),
                    &ModelTarget::default(),
                    ProjectionRules {
                        tool_calls: ToolCallRendering::ClaudeInvoke,
                        images: ImageSizing::Placeholder,
                    }
                )
                .text,
                format!("Checking.\nbash\n{arguments}")
            );
        }
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
            thinking_reported: false,
        };
        let preview = preview_payload(&payload);
        assert_eq!(preview.kind, PreviewKind::ToolCall);
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
        assert_eq!(preview.kind, PreviewKind::ToolResult);
        assert_eq!(preview.text, "bash [error] first result line");
        assert_eq!(
            preview.expanded_text,
            "bash [error] first result line\nsecond result line"
        );
        assert!(!preview.expanded_truncated);
        assert!(preview.truncated);
    }

    #[test]
    fn preview_kind_wire_spellings_remain_exact() {
        use PreviewKind::*;
        assert_eq!(
            [Text, Image, ToolCall, ToolResult, Summary, Unavailable].map(PreviewKind::as_str),
            [
                "text",
                "image",
                "toolCall",
                "toolResult",
                "summary",
                "unavailable"
            ]
        );
    }

    #[test]
    fn encoded_image_size_handles_missing_zero_and_unicode_metadata_honestly() {
        for (media_type, length, expected) in [
            (None, None, "[image: unknown]"),
            (Some("image/png"), None, "[image: image/png]"),
            (None, Some(0), "[image: unknown, 0.0 B encoded]"),
            (
                Some("image/png"),
                Some(8),
                "[image: image/png, 8.0 B encoded]",
            ),
        ] {
            let payload = TokenizationPayload::UserMessage(MessageContent {
                parts: vec![ContentPart::Image(ImageDescriptor {
                    media_type: media_type.map(str::to_owned),
                    encoded_data_length: length,
                    dimensions: None,
                })],
            });
            let preview = preview_payload(&payload);
            assert_eq!(preview.text, expected);
            assert_eq!(preview.expanded_text, expected);
        }
        let payload = TokenizationPayload::UserMessage(MessageContent {
            parts: vec![ContentPart::Image(ImageDescriptor {
                media_type: Some("画".repeat(EXPANDED_PREVIEW_LIMIT + 20)),
                encoded_data_length: Some(8),
                dimensions: None,
            })],
        });
        let preview = preview_payload(&payload);
        assert!(preview.text.chars().count() <= PREVIEW_LIMIT);
        assert!(preview.expanded_text.chars().count() <= EXPANDED_PREVIEW_LIMIT);
        assert!(preview.truncated && preview.expanded_truncated);
    }

    #[test]
    fn encoded_image_field_rename_preserves_the_v4_fingerprint_contract() {
        let payload = TokenizationPayload::UserMessage(MessageContent {
            parts: vec![ContentPart::Image(ImageDescriptor {
                media_type: Some("image/png".into()),
                encoded_data_length: Some(8),
                dimensions: None,
            })],
        });
        assert_eq!(PAYLOAD_SCHEMA_VERSION, 4);
        // Verified against the pre-M8 encoder (legacy `byte_length` field/tag).
        assert_eq!(
            payload_hash(&payload),
            "10b74ba9ed7fd575f7593af8a2bbd8d97a47a3de1d684977af6a9b1759b2f50e"
        );
        let absent = TokenizationPayload::UserMessage(MessageContent {
            parts: vec![ContentPart::Image(ImageDescriptor {
                media_type: Some("image/png".into()),
                encoded_data_length: None,
                dimensions: None,
            })],
        });
        let zero = TokenizationPayload::UserMessage(MessageContent {
            parts: vec![ContentPart::Image(ImageDescriptor {
                media_type: Some("image/png".into()),
                encoded_data_length: Some(0),
                dimensions: None,
            })],
        });
        assert_ne!(payload_fingerprint(&absent), payload_fingerprint(&zero));
    }

    #[test]
    fn image_previews_retain_available_metadata() {
        let payload = TokenizationPayload::UserMessage(MessageContent {
            parts: vec![ContentPart::Image(ImageDescriptor {
                media_type: Some("image/png".into()),
                encoded_data_length: Some(24_900),
                dimensions: None,
            })],
        });
        let preview = preview_payload(&payload);
        assert_eq!(preview.kind, PreviewKind::Image);
        assert_eq!(preview.text, "[image: image/png, 24.3 KB encoded]");
        assert_eq!(preview.expanded_text, preview.text);
        assert!(!preview.expanded_truncated);
    }

    #[test]
    fn unavailable_previews_remain_explicit_and_bounded() {
        let preview = preview_payload(&TokenizationPayload::Unavailable);
        assert_eq!(preview.kind, PreviewKind::Unavailable);
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
