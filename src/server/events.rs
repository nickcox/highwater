use super::AppState;
use axum::{
    extract::State,
    response::sse::{Event, KeepAlive, Sse},
};
use futures_util::{stream, StreamExt};
use serde::Serialize;
use std::{collections::VecDeque, convert::Infallible, time::Duration};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub(crate) enum LiveAvailability {
    Active,
    Degraded,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct LiveState {
    pub generation: String,
    pub revision: u64,
    pub availability: LiveAvailability,
}

#[derive(Serialize)]
struct CatalogueData<'a> {
    generation: &'a str,
    revision: String,
}

#[derive(Serialize)]
struct StatusData<'a> {
    generation: &'a str,
    availability: LiveAvailability,
}

pub(crate) async fn handler(
    State(state): State<AppState>,
) -> Sse<impl futures_util::Stream<Item = Result<Event, Infallible>>> {
    // Subscribe before taking the initial snapshot. Otherwise a publication
    // between these two operations can be marked as already observed and
    // never reach this client.
    let mut receiver = state.live_state.subscribe();
    let initial = receiver.borrow_and_update().clone();
    let mut shutdown = state.shutdown.subscribe();
    let shutdown_closed = *shutdown.borrow_and_update();
    let updates = stream::unfold(
        (
            receiver,
            shutdown,
            initial.clone(),
            VecDeque::new(),
            shutdown_closed,
        ),
        |(mut receiver, mut shutdown, mut previous, mut pending, shutdown_closed)| async move {
            loop {
                if shutdown_closed {
                    return None;
                }
                if let Some(event) = pending.pop_front() {
                    return Some((
                        event,
                        (receiver, shutdown, previous, pending, shutdown_closed),
                    ));
                }
                tokio::select! {
                    shutdown_result = shutdown.changed() => {
                        if shutdown_result.is_err() || *shutdown.borrow_and_update() {
                            return None;
                        }
                    }
                    state_result = receiver.changed() => {
                        if state_result.is_err() {
                            return None;
                        }
                        let current = receiver.borrow_and_update().clone();
                        if previous.generation != current.generation
                            || previous.revision != current.revision
                        {
                            pending.push_back(Ok(catalogue_event(&current)));
                        }
                        if previous.generation != current.generation
                            || previous.availability != current.availability
                        {
                            pending.push_back(Ok(status_event(&current)));
                        }
                        previous = current;
                    }
                }
            }
        },
    );
    let stream = stream::iter(initial_events(&initial)).chain(updates);

    Sse::new(stream).keep_alive(KeepAlive::new().interval(Duration::from_secs(15)).text(""))
}

fn initial_events(state: &LiveState) -> Vec<Result<Event, Infallible>> {
    vec![Ok(catalogue_event(state)), Ok(status_event(state))]
}

fn catalogue_event(state: &LiveState) -> Event {
    let data = serde_json::to_string(&CatalogueData {
        generation: &state.generation,
        revision: state.revision.to_string(),
    })
    .expect("catalogue SSE data contains only serializable primitives");
    Event::default()
        .id(format!("{}:{}", state.generation, state.revision))
        .event("sessionsChanged")
        .data(data)
}

fn status_event(state: &LiveState) -> Event {
    let data = serde_json::to_string(&StatusData {
        generation: &state.generation,
        availability: state.availability,
    })
    .expect("status SSE data contains only serializable primitives");
    Event::default().event("liveStatus").data(data)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn state(revision: u64, availability: LiveAvailability) -> LiveState {
        LiveState {
            generation: "0123456789abcdef0123456789abcdef".into(),
            revision,
            availability,
        }
    }

    #[test]
    fn connection_starts_with_both_current_state_events() {
        assert_eq!(
            initial_events(&state(2, LiveAvailability::Degraded)).len(),
            2
        );
    }
}
