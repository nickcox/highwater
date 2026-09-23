use crate::domain::ModelTarget;

const TIKTOKEN_VERSION: &str = "tiktoken-4.1.2";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub(crate) enum TokenizationPolicy {
    Auto,
    Strict,
    Heuristic,
    Off,
}

impl TokenizationPolicy {
    pub(crate) fn as_str(self) -> &'static str {
        match self {
            Self::Auto => "auto",
            Self::Strict => "strict",
            Self::Heuristic => "heuristic",
            Self::Off => "off",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum TokenizerFamily {
    O200k,
    Cl100k,
    CharacterHeuristic,
    Unavailable,
}

impl TokenizerFamily {
    pub(crate) fn as_str(self) -> &'static str {
        match self {
            Self::O200k => "o200k",
            Self::Cl100k => "cl100k",
            Self::CharacterHeuristic => "unicode-scalar-div-4",
            Self::Unavailable => "unavailable",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum TokenizationMethod {
    ModelTokenizer,
    ApiSerializationEstimate,
    CharacterHeuristic,
    Unavailable,
}

impl TokenizationMethod {
    pub(crate) fn as_str(self) -> &'static str {
        match self {
            Self::ModelTokenizer => "modelTokenizer",
            Self::ApiSerializationEstimate => "apiSerializationEstimate",
            Self::CharacterHeuristic => "characterHeuristic",
            Self::Unavailable => "unavailable",
        }
    }
}

#[derive(Debug, Clone)]
pub(crate) struct TokenizationProfile {
    pub id: String,
    pub provider: String,
    pub model: String,
    pub api: Option<String>,
    pub family: TokenizerFamily,
    pub method: TokenizationMethod,
    pub version: u32,
    pub rule: String,
}

impl TokenizationProfile {
    pub(crate) fn framing_overhead(&self, message_count: usize) -> Option<u64> {
        match self.family {
            // This is the documented approximation used by the local OpenAI chat
            // serialization model: three tokens per message and three priming tokens.
            TokenizerFamily::O200k | TokenizerFamily::Cl100k => u64::try_from(message_count)
                .ok()?
                .checked_mul(3)?
                .checked_add(3),
            // Provider-specific heuristic profiles do not have documented local
            // framing rules, so their framing contribution remains unknown.
            TokenizerFamily::CharacterHeuristic | TokenizerFamily::Unavailable => None,
        }
    }
}

pub(crate) fn resolve_profile(
    target: &ModelTarget,
    policy: TokenizationPolicy,
) -> TokenizationProfile {
    let provider = target.provider.clone().unwrap_or_else(|| "unknown".into());
    let model = target.model.clone().unwrap_or_else(|| "unknown".into());
    let api = target.api.clone();
    if policy == TokenizationPolicy::Off {
        return build_profile(
            provider,
            model,
            api,
            TokenizerFamily::Unavailable,
            TokenizationMethod::Unavailable,
            "disabled",
        );
    }
    if policy == TokenizationPolicy::Heuristic {
        return build_profile(
            provider,
            model,
            api,
            TokenizerFamily::CharacterHeuristic,
            TokenizationMethod::CharacterHeuristic,
            "forced-character-heuristic",
        );
    }

    let lower_provider = provider.to_ascii_lowercase();
    let lower_model = model.to_ascii_lowercase();
    let is_gpt6 = lower_model.starts_with("gpt-6");
    let matched = if is_gpt6
        && (is_openai_provider(&lower_provider)
            || (lower_provider == "github-copilot" && api.as_deref() == Some("openai-responses")))
    {
        // Assumption, not a published OpenAI model mapping: in local text-only
        // GPT-6 Sol/Astra responses, reported output tokens match o200k_base
        // text tokens plus the same four-token overhead observed for GPT-5.6.
        // Revisit when OpenAI publishes the GPT-6 encoding. Keep the provider/API
        // gate: a model name alone is not proof of the underlying tokenizer.
        Some((TokenizerFamily::O200k, "assumed-gpt6-o200k-base"))
    } else if is_openai_provider(&lower_provider) {
        tiktoken::model_to_encoding(&lower_model).and_then(|encoding| match encoding {
            "o200k_base" => Some((TokenizerFamily::O200k, "tiktoken-o200k-base")),
            "cl100k_base" => Some((TokenizerFamily::Cl100k, "tiktoken-cl100k-base")),
            _ => None,
        })
    } else {
        None
    };
    if let Some((family, rule)) = matched {
        return build_profile(
            provider,
            model,
            api,
            family,
            TokenizationMethod::ModelTokenizer,
            rule,
        );
    }
    if lower_provider == "anthropic" || lower_provider == "google" {
        return build_profile(
            provider,
            model,
            api,
            TokenizerFamily::CharacterHeuristic,
            TokenizationMethod::ApiSerializationEstimate,
            "provider-api-serialization-estimate",
        );
    }
    if policy == TokenizationPolicy::Strict {
        build_profile(
            provider,
            model,
            api,
            TokenizerFamily::Unavailable,
            TokenizationMethod::Unavailable,
            "no-matched-tokenizer",
        )
    } else {
        build_profile(
            provider,
            model,
            api,
            TokenizerFamily::CharacterHeuristic,
            TokenizationMethod::CharacterHeuristic,
            "source-neutral-character-fallback",
        )
    }
}

fn build_profile(
    provider: String,
    model: String,
    api: Option<String>,
    family: TokenizerFamily,
    method: TokenizationMethod,
    rule: &str,
) -> TokenizationProfile {
    let api_label = api.as_deref().unwrap_or("unknown");
    let implementation = match family {
        TokenizerFamily::O200k | TokenizerFamily::Cl100k => TIKTOKEN_VERSION,
        TokenizerFamily::CharacterHeuristic => "tokenplume-character-heuristic-v1",
        TokenizerFamily::Unavailable => "tokenplume-unavailable-v1",
    };
    let id = format!(
        "{}:{}:{}:{}:{}:v2",
        provider,
        model,
        api_label,
        family.as_str(),
        implementation
    );
    TokenizationProfile {
        id,
        provider,
        model,
        api,
        family,
        method,
        version: 2,
        rule: rule.into(),
    }
}

fn is_openai_provider(provider: &str) -> bool {
    matches!(provider, "openai" | "openai-codex")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn gpt6_assumption_is_scoped_to_openai_and_verified_copilot_route() {
        for (provider, api) in [
            ("openai", "openai-responses"),
            ("openai-codex", "openai-codex-responses"),
            ("github-copilot", "openai-responses"),
        ] {
            for model in ["gpt-6-sol", "gpt-6-astra", "gpt-6-future"] {
                let target = ModelTarget {
                    provider: Some(provider.into()),
                    model: Some(model.into()),
                    api: Some(api.into()),
                };
                let auto = resolve_profile(&target, TokenizationPolicy::Auto);
                assert_eq!(auto.family, TokenizerFamily::O200k, "{provider}/{model}");
                assert_eq!(auto.method, TokenizationMethod::ModelTokenizer);
                assert_eq!(auto.rule, "assumed-gpt6-o200k-base");
                assert!(auto.id.contains("o200k:tiktoken-4.1.2"));
                assert_eq!(
                    resolve_profile(&target, TokenizationPolicy::Strict).family,
                    TokenizerFamily::O200k
                );
                assert_eq!(
                    resolve_profile(&target, TokenizationPolicy::Heuristic).method,
                    TokenizationMethod::CharacterHeuristic
                );
                assert_eq!(
                    resolve_profile(&target, TokenizationPolicy::Off).method,
                    TokenizationMethod::Unavailable
                );
            }
        }
        for (provider, api) in [
            ("github-copilot", "openai-completions"),
            ("openrouter", "openai-responses"),
            ("unknown", "openai-responses"),
        ] {
            let target = ModelTarget {
                provider: Some(provider.into()),
                model: Some("gpt-6-astra".into()),
                api: Some(api.into()),
            };
            assert_eq!(
                resolve_profile(&target, TokenizationPolicy::Auto).method,
                TokenizationMethod::CharacterHeuristic
            );
            assert_eq!(
                resolve_profile(&target, TokenizationPolicy::Strict).method,
                TokenizationMethod::Unavailable
            );
        }
    }

    #[test]
    fn resolves_library_openai_families_and_codex_aliases() {
        let gpt4o = resolve_profile(
            &ModelTarget {
                provider: Some("openai".into()),
                model: Some("gpt-4o-mini".into()),
                api: None,
            },
            TokenizationPolicy::Auto,
        );
        assert_eq!(gpt4o.family, TokenizerFamily::O200k);
        assert_eq!(gpt4o.method, TokenizationMethod::ModelTokenizer);
        for model in ["gpt-5.6-sol", "gpt-5.6-luna"] {
            let codex = resolve_profile(
                &ModelTarget {
                    provider: Some("openai-codex".into()),
                    model: Some(model.into()),
                    api: Some("openai-codex-responses".into()),
                },
                TokenizationPolicy::Auto,
            );
            assert_eq!(codex.family, TokenizerFamily::O200k);
            assert_eq!(codex.method, TokenizationMethod::ModelTokenizer);
            assert_eq!(codex.rule, "tiktoken-o200k-base");
        }
        let gpt4 = resolve_profile(
            &ModelTarget {
                provider: Some("openai".into()),
                model: Some("gpt-4-turbo".into()),
                api: None,
            },
            TokenizationPolicy::Auto,
        );
        assert_eq!(gpt4.family, TokenizerFamily::Cl100k);
        let unknown = resolve_profile(
            &ModelTarget {
                provider: Some("openai".into()),
                model: Some("gpt-unknown-custom".into()),
                api: None,
            },
            TokenizationPolicy::Strict,
        );
        assert_eq!(unknown.method, TokenizationMethod::Unavailable);
        let anthropic = resolve_profile(
            &ModelTarget {
                provider: Some("anthropic".into()),
                model: Some("claude-sonnet".into()),
                api: Some("messages".into()),
            },
            TokenizationPolicy::Auto,
        );
        assert_eq!(
            anthropic.method,
            TokenizationMethod::ApiSerializationEstimate
        );
        assert_eq!(anthropic.framing_overhead(3), None);

        for provider in [None, Some("unknown"), Some("together")] {
            let fallback = resolve_profile(
                &ModelTarget {
                    provider: provider.map(str::to_owned),
                    model: Some("gpt-4o".into()),
                    api: None,
                },
                TokenizationPolicy::Auto,
            );
            assert_eq!(fallback.method, TokenizationMethod::CharacterHeuristic);
            assert_eq!(fallback.family, TokenizerFamily::CharacterHeuristic);

            let unavailable = resolve_profile(
                &ModelTarget {
                    provider: provider.map(str::to_owned),
                    model: Some("gpt-4o".into()),
                    api: None,
                },
                TokenizationPolicy::Strict,
            );
            assert_eq!(unavailable.method, TokenizationMethod::Unavailable);
        }
    }
}
