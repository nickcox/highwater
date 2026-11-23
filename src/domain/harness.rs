use serde::{Serialize, Serializer};

/// The coding agent that wrote a session. `as_str` is the name used on the wire, in the
/// price data and in session references.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub(crate) enum Harness {
    Pi,
    OpenCode,
    ClaudeCode,
    Codex,
    Copilot,
    VsCodeCopilot,
    /// A source with no harness-specific behaviour, for tests.
    #[cfg(test)]
    Test(&'static str),
}

impl Harness {
    /// In the order the session picker and the startup summary list them.
    pub(crate) const ALL: [Self; 6] = [
        Self::Pi,
        Self::OpenCode,
        Self::ClaudeCode,
        Self::Codex,
        Self::Copilot,
        Self::VsCodeCopilot,
    ];

    pub(crate) fn as_str(self) -> &'static str {
        match self {
            Self::Pi => "pi",
            Self::OpenCode => "opencode",
            Self::ClaudeCode => "claude-code",
            Self::Codex => "codex",
            Self::Copilot => "copilot",
            Self::VsCodeCopilot => "vscode-copilot",
            #[cfg(test)]
            Self::Test(name) => name,
        }
    }

    pub(crate) fn display_name(self) -> &'static str {
        match self {
            Self::Pi => "Pi",
            Self::OpenCode => "OpenCode",
            Self::ClaudeCode => "Claude Code",
            Self::Codex => "Codex",
            Self::Copilot => "Copilot",
            Self::VsCodeCopilot => "VS Code Copilot",
            #[cfg(test)]
            Self::Test(name) => name,
        }
    }

    /// Records token usage but not Pi's cost components, so the cache figures leave out the
    /// cost interpretation (`economics::derive_usage_only`).
    pub(crate) fn records_usage_only(self) -> bool {
        match self {
            Self::ClaudeCode | Self::Codex | Self::Copilot | Self::VsCodeCopilot => true,
            Self::Pi | Self::OpenCode => false,
            #[cfg(test)]
            Self::Test(_) => false,
        }
    }

    /// Does not record all of a request's content (the system prompt and tool definitions,
    /// for example), so analysis adds an item for it, sized from the reported input.
    pub(crate) fn estimates_unrecorded_context(self) -> bool {
        match self {
            Self::OpenCode
            | Self::ClaudeCode
            | Self::Codex
            | Self::Copilot
            | Self::VsCodeCopilot => true,
            Self::Pi => false,
            #[cfg(test)]
            Self::Test(_) => false,
        }
    }

    /// The reference a session is listed under: a hash of the fields `write` adds, keyed by
    /// the harness. Pi's references are made differently.
    pub(crate) fn session_reference(self, write: impl FnOnce(&mut blake3::Hasher)) -> String {
        let mut hash = blake3::Hasher::new_derive_key(&format!(
            "Highwater {} session reference v1",
            self.display_name()
        ));
        write(&mut hash);
        format!("{}-{}", self.as_str(), &hash.finalize().to_hex()[..12])
    }
}

impl Serialize for Harness {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(self.as_str())
    }
}
