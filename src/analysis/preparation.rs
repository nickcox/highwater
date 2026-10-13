use super::*;

/// Borrowed, frozen plan. Registry mutation ends before any metrics are derived.
/// Sparse per-item profile maps avoid an items-by-profiles matrix and repeated
/// estimate copies for every presence.
pub(super) struct PreparedAnalysis<'a> {
    pub registry: ProfileRegistry,
    pub works: Vec<CallWork<'a>>,
    pub item_lookup: FxHashMap<&'a str, &'a NormalizedContextItem>,
    /// Item ID to its position in `session.context_items` and the API item list.
    pub item_positions: FxHashMap<&'a str, usize>,
    pub transitions: Vec<DerivedTransition<'a>>,
    pub destination_estimates: Vec<HashMap<&'a str, EstimateIndex>>,
    pub item_estimates: Vec<BTreeMap<String, EstimateIndex>>,
    pub methods: BTreeMap<String, usize>,
    pub fingerprint_ms: f64,
    pub tokenize_ms: f64,
}

/// Calculates, on several threads, every estimate `prepare` will look up: each call's items,
/// and the previous call's items, which the call's transition measures at its own profile.
pub(super) fn precompute_estimates(
    session: &NormalizedSession,
    registry: &mut ProfileRegistry,
    policy: TokenizationPolicy,
) {
    let positions = session
        .context_items
        .iter()
        .enumerate()
        .map(|(position, item)| (item.id.as_str(), position))
        .collect::<FxHashMap<_, _>>();
    let mut fingerprints = vec![None; session.context_items.len()];
    let mut queued = FxHashSet::default();
    let mut pairs = Vec::new();
    let mut previous: &[String] = &[];
    let targets = tokenization_targets(&session.model_calls);
    for (call, target) in session.model_calls.iter().zip(targets) {
        let profile = registry.profile_index(target, policy);
        for id in call.context_item_ids.iter().chain(previous) {
            let Some(&position) = positions.get(id.as_str()) else {
                continue;
            };
            if queued.insert((position, profile)) {
                let item = &session.context_items[position];
                let fingerprint = *fingerprints[position]
                    .get_or_insert_with(|| payload_fingerprint(&item.payload));
                pairs.push((item, fingerprint, profile));
            }
        }
        previous = &call.context_item_ids;
    }
    registry.precompute(&pairs);
}

pub(super) fn prepare<'a>(
    session: &'a NormalizedSession,
    validated: &ValidatedSession<'a>,
    config: AnalysisConfig,
    mut registry: ProfileRegistry,
) -> PreparedAnalysis<'a> {
    let item_lookup = validated
        .item_indices
        .iter()
        .map(|(id, index)| (*id, &session.context_items[*index]))
        .collect();
    let started = Instant::now();
    let fingerprints = session
        .context_items
        .iter()
        .map(|item| registry.fingerprint_item(item))
        .collect::<Vec<_>>();
    let fingerprint_ms = started.elapsed().as_secs_f64() * 1000.0;
    let started = Instant::now();
    let mut planned =
        vec![HashMap::<ProfileIndex, EstimateIndex>::new(); session.context_items.len()];
    let mut plan_estimate =
        |item_index: usize, profile_index: ProfileIndex, registry: &mut ProfileRegistry| {
            *planned[item_index].entry(profile_index).or_insert_with(|| {
                registry.estimate_index_at_profile(
                    &session.context_items[item_index],
                    fingerprints[item_index],
                    profile_index,
                )
            })
        };
    let mut methods = BTreeMap::<String, usize>::new();
    let works = session
        .model_calls
        .iter()
        .zip(tokenization_targets(&session.model_calls))
        .map(|(call, target)| {
            let profile_index = registry.profile_index(target, config.tokenization);
            let estimate_indexes = call
                .context_item_ids
                .iter()
                .map(|id| {
                    plan_estimate(
                        validated.item_indices[id.as_str()],
                        profile_index,
                        &mut registry,
                    )
                })
                .collect();
            *methods
                .entry(registry.profile_at(profile_index).method.as_str().into())
                .or_default() += 1;
            CallWork {
                call,
                profile_index,
                context_membership: call.context_item_ids.iter().map(String::as_str).collect(),
                estimate_indexes,
            }
        })
        .collect::<Vec<_>>();
    let transitions = works
        .iter()
        .enumerate()
        .map(|(position, work)| derive_transition(&works, position, work))
        .collect::<Vec<_>>();
    let mut destination_estimates = vec![HashMap::new(); works.len()];
    for position in 1..works.len() {
        for id in &transitions[position].dropped_ids {
            let item_index = validated.item_indices[*id];
            let index = plan_estimate(item_index, works[position].profile_index, &mut registry);
            destination_estimates[position]
                .insert(session.context_items[item_index].id.as_str(), index);
        }
    }
    let item_estimates = planned
        .into_iter()
        .map(|estimates| {
            estimates
                .into_iter()
                .map(|(profile, estimate)| (registry.profile_at(profile).id.clone(), estimate))
                .collect()
        })
        .collect();
    PreparedAnalysis {
        registry,
        works,
        item_lookup,
        item_positions: validated.item_indices.clone(),
        transitions,
        destination_estimates,
        item_estimates,
        methods,
        fingerprint_ms,
        tokenize_ms: started.elapsed().as_secs_f64() * 1000.0,
    }
}
