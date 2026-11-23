/// What a reader could not establish from the session. Declaration order is
/// the order used for explanation codes in the analysis response.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub(crate) enum Limitation {
    /// Historical system instructions are incomplete (Claude Code, VS Code Copilot, OpenCode).
    MissingHistoricalSystemPrompt,
    /// Historical tool definitions are incomplete (Claude Code, Codex, Copilot,
    /// VS Code Copilot, OpenCode).
    MissingHistoricalToolDefinitions,
    /// The harness's own calls are not recorded: titles, summaries and compaction
    /// in Claude Code, and titles, progress messages and tool grouping in VS Code
    /// Copilot. Copilot reports usage outside a turn without showing the calls.
    UnrecordedHarnessCalls,
    /// Plugins and provider request transformations may not be recorded (OpenCode).
    UnrecordedRequestTransforms,
    /// The reader could not establish whether output usage includes reasoning (OpenCode).
    UnknownOutputAccounting,
    /// The exact prompt used to generate a compaction summary is not recorded (OpenCode).
    UnknownCompactionPrompt,
    /// A summary has no matching compaction marker, so no history reset is inferred (OpenCode).
    UnpairedCompactionSummary,
    /// A tool-result pruning boundary cannot be ordered precisely against a call (OpenCode).
    AmbiguousPruningBoundary,
    /// A compaction has no request usage (Claude Code, Codex, Copilot, OpenCode).
    MissingCompactionUsage,
    /// A compaction does not identify the messages it kept, so only the summary
    /// is kept (Claude Code without `preservedSegment`, Codex, Copilot).
    UnverifiedCompactionRetention,
    /// An attachment of a type that is sent is recorded without its text (Claude
    /// Code, Copilot). VS Code Copilot records a request with attachments without
    /// the message as sent, so only the typed text is known.
    UnrenderedAttachments,
    /// A request that made several model calls but recorded no rounds (one stopped
    /// or interrupted, for example) is shown as one call (VS Code Copilot).
    UnrecordedRounds,
    /// Some calls have no trace records (deleted, never written, or not matching
    /// the session file), so they use the session file alone (VS Code Copilot).
    TraceRecordsIncomplete,
    /// No model call could be matched to a trace (VS Code Copilot).
    TraceRecordsUnavailable,
    /// The trace database exists but could not be read (VS Code Copilot).
    TraceRecordsUnreadable,
    /// Some recorded content cannot be represented in model context (Claude Code,
    /// Codex, Copilot, VS Code Copilot, OpenCode).
    UnsupportedContent,
    /// One storage generation was selected using recorded recency and projection
    /// availability (OpenCode).
    StorageGenerationSelection,
    /// A compaction billing record may aggregate multiple requests (OpenCode).
    AggregatedCompactionUsage,
    /// Migrated assistant records may omit original request boundaries or include
    /// synthetic attempts (OpenCode).
    ProjectedRequestBoundaries,
    /// A compaction boundary named a later or missing record as its predecessor;
    /// the branch continued from the last record before the boundary (Claude Code).
    RepairedCompactionLink,
    /// A thread's inherited history was mostly not sent, judged from reported usage (Codex).
    InferredUnsentHistory,
    /// The context was reset without a compaction record, judged from reported usage (Codex).
    InferredContextReset,
    /// Subagents' calls are recorded in the main session's file but are not shown (Copilot).
    SubagentCallsNotShown,
}

impl Limitation {
    pub(crate) fn as_str(self) -> &'static str {
        match self {
            Self::MissingHistoricalSystemPrompt => "missingHistoricalSystemPrompt",
            Self::MissingHistoricalToolDefinitions => "missingHistoricalToolDefinitions",
            Self::UnrecordedHarnessCalls => "unrecordedHarnessCalls",
            Self::UnrecordedRequestTransforms => "unrecordedRequestTransforms",
            Self::UnknownOutputAccounting => "unknownOutputAccounting",
            Self::UnknownCompactionPrompt => "unknownCompactionPrompt",
            Self::UnpairedCompactionSummary => "unpairedCompactionSummary",
            Self::AmbiguousPruningBoundary => "ambiguousPruningBoundary",
            Self::MissingCompactionUsage => "missingCompactionUsage",
            Self::UnverifiedCompactionRetention => "unverifiedCompactionRetention",
            Self::UnrenderedAttachments => "unrenderedAttachments",
            Self::UnrecordedRounds => "unrecordedRounds",
            Self::TraceRecordsIncomplete => "traceRecordsIncomplete",
            Self::TraceRecordsUnavailable => "traceRecordsUnavailable",
            Self::TraceRecordsUnreadable => "traceRecordsUnreadable",
            Self::UnsupportedContent => "unsupportedContent",
            Self::StorageGenerationSelection => "storageGenerationSelection",
            Self::AggregatedCompactionUsage => "aggregatedCompactionUsage",
            Self::ProjectedRequestBoundaries => "projectedRequestBoundaries",
            Self::RepairedCompactionLink => "repairedCompactionLink",
            Self::InferredUnsentHistory => "inferredUnsentHistory",
            Self::InferredContextReset => "inferredContextReset",
            Self::SubagentCallsNotShown => "subagentCallsNotShown",
        }
    }
}
