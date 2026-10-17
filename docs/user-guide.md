# Highwater user guide

How to open sessions and read the Context River, Composition and lifespans views. For what the numbers mean and where they come from, see [data semantics](data-semantics.md).

## Opening a session

Open the URL Highwater prints when it starts. The server listens only on `127.0.0.1` and never changes session files. It also rejects any request whose `Host` (or `Origin`, when present) is not `127.0.0.1` or `localhost` on its own port, so a web page cannot use DNS rebinding to read your sessions.

The picker has a **Harness** list (All harnesses, Pi, OpenCode, Claude Code, VS Code Copilot) and a **Session** field showing the open session. Click or type in the field to open the session list; typing filters it by title or working directory. ↑/↓ and Enter choose a session, and Escape closes the list without changing anything. Filtering never switches the open session.

When the list mixes harnesses, each entry names the application that recorded it.

**Child sessions.** An OpenCode child session or a Claude Code subagent is its own session, labelled **child session** (followed by the subagent's type for Claude Code), and its context is not merged into the parent's. The list leaves child sessions out unless **Include child sessions** is ticked; then each one is indented under the session that started it, and a search that matches a child session also shows the sessions above it. A child session whose parent is not listed is shown at the top level. Under the session summary, a session lists its child sessions and a child session links to its parent. That link opens the parent with the tool call that started the child selected. In the parent, the item details of that tool call's result link to the child session. Each session's figures, including cost, cover only that session. If the same native session ID appears in two OpenCode databases, Highwater refuses to open it rather than pick one copy.

Going back to a session you viewed recently shows the analysis the browser kept, then checks with the server in the background whether it has changed. If that check fails, the kept view stays and a warning appears.

## The session summary

The summary shows the number of model calls and context items, the peak calculated context, and the cost.

**Cost** is the session's cost at API rates: each call's recorded cost, or an estimate at the provider's rate on the call's date. Calls covered by a subscription, such as a ChatGPT plan, are priced at what they would have cost. It is not an invoice. When a session has both kinds of call, a line underneath splits the cost into what was billed per token and what a subscription covered. Calls without a price, and failed attempts, are counted under the amount. The Cost tile's note explains how the cost was worked out and where the prices came from; see [cost assessment](data-semantics.md#cost-assessment) for the rules.

**Estimates: good / partial / rough** rates the River's token estimates by how closely they match the input the provider reported: within 2% on the median is good, within 10% partial. When nothing can be compared, it rates them by how the tokens were counted. Its note explains the rating and lists what the source does not record.

**Session details** opens to show:

- the billed cost (Pi and OpenCode) and the cost the harness recorded, or that it recorded none;
- Claude Code's own session total, when its transcript records one. It is a running total that also includes subagents and Claude Code's own calls, so it is never added to the other figures;
- VS Code Copilot's own total from the credits it recorded for each request, shown when it differs from the recorded call costs because some calls' trace records are gone;
- token usage across all calls, cache-read share, compactions, model and provider, and session metadata;
- a closed **Diagnostics** section with the estimator's own figures: usage and estimate coverage, token-turns, reconciliation, tokenizer methods and profiles.

## The Context River

Each band is a context item, drawn at its estimated size at every model call it was present for. Calls run left to right.

**Moving around.** Moving the pointer over the chart moves a crosshair to the nearest call. The toolbar shows the visible call range and has **‹ / ›** buttons to step between calls, zoom controls, **Fit all**, **Latest**, and a **Go to call** field. Drag across an area to zoom to it, scroll sideways or Shift-drag to pan, and pinch or use a modifier key with the scroll wheel to zoom.

- **← / →** step between calls, and so do **h / l** while the River has focus. Text fields, IME input, modifier shortcuts and tab lists keep their own keys, and Composition does not react to these shortcuts.
- Stepping keeps the selected item, even when it is not present at the new call, and keeps the zoom. It moves the view only when the new call is near or past the edge. With no pinned call, the Fit all view steps forward from the first call; a zoomed or scrolled view steps from the call nearest its centre.
- **Go to call** pins the call you type, keeps the selected item and zoom (including Fit all), and moves the call into view when needed. Escape in the field cancels the entry without clearing the pin or item.

**Scale and display.** Under the toolbar, **Vertical scale** and **Display** are always shown. **Session scale**, the default, keeps band heights comparable across the whole session. **Visible calls** scales to the calls in view, including points interpolated at the edges, so heights change as you pan or zoom; read the axis before comparing heights. **Display** switches between **Items** and **Item types**. When token counts are not available for a session, the axis says it is showing placeholder sizes, not tokens.

**Selecting.** Click empty chart space or a call label to pin that call's details; the selected item stays selected. Click a band, or focus it and press Enter or Space, to select its item and pin the first call it was included in, wherever you clicked. That is the item's first appearance in the model's context, not necessarily the call that created it. Selecting never pans or zooms. Only the selected band is outlined; other bands keep their normal opacity. Hovering a band shows a preview of the item.

**Reported input.** Where the provider recorded each call's input, a dashed **Reported input** line shows it, and hatched **Unreconciled input** fills the gap between the stacked estimates and that line. Both appear in either display mode and either scale. The line breaks where a call has no comparable figure, and estimates above the reported input are never shrunk to fit. The gap is an approximate difference, not missing items, and it does not change item counts, lifetimes, token-turns, Composition or costs.

**Versions.** A request carries one system prompt and one definition per tool, so when a new one replaces the previous one, Highwater shows them as versions of one item. Versions share a colour and a place in the stack, and each version's band runs into the next. A white mark shows where the system prompt changes; tool definitions are too thin to mark.

**Compaction.** In **Items** view, faint colour-blended flows join the items a compaction removed to the summary's band, and retained items carry on unchanged. The flows show that the summary took the place of those items. They do not show how much of an item's content the summary kept, or how many of the summary's tokens came from each item. Hovering or selecting a removed item highlights its flow, and selecting the summary lightly highlights all of its incoming flows. **Item types** view does not draw flows, and a summary from the end of a session, with no call after it, has no band.

**Item types.** This view draws one band per kind of item, with fixed colours shared with its legend: user messages blue, tool results gold, assistant messages teal, compaction summaries lavender, and distinct colours for the rest. The colours identify kinds, not cache status. In **Items** view and in Composition, each item's colour comes from its ID. Hovering a kind's band shows its tokens at that call and how many items it has. Clicking the band, or pressing Enter on it, opens a breakdown of its items beside it without scrolling the page. Scrolling the page or the chart closes the breakdown, though its own item list can scroll, and Escape or **Close** returns focus to the band.

## Cache & cost

The **▸ Cache & cost** disclosure under the River starts closed. Open it to choose **Cache**, **Cost** or **Off**, and for Cache, **Tokens** or **Share (%)**. Closing it or choosing Off keeps your last choices for next time.

- **Cache** shows each call's cache reads, cache writes and fresh input, where the source's usage figures support it. Missing, partial, unsupported and measured-zero calls are each marked differently.
- **Cost** shows each call's assessed cost. API-equivalent costs are hollow, dashed marks in their own colour, and a shaded bar marks a cost that is a range.

Neither cache figures nor costs are divided among items. The track shares the River's call axis. Compactions, model or provider changes, and large changes in cache-read share appear in a separate events lane; markers that would overlap are grouped, and activating one lists its events and their calls. The exact figures for the hovered or pinned call appear under the chart and stay in place as the River pans.

## Composition

**Composition** is a separate tab. It starts in **Cumulative** scope, which adds each item's estimate once for every call it was present in, up to the pinned call or across the whole session when nothing is pinned. That measures how much each item was sent, in estimated token-turns; it is not unique content, provider usage, billed tokens or cost. **At call** shows the estimates at one call.

The treemap's areas and shares use the estimates available in that scope, and say when coverage is missing or partial. Items too small to draw, with zero estimates or with no estimate are still listed in the ranked **List**. Provider prompt counts, known request framing and reconciliation details are shown only in **At call** scope, under **Compare with provider usage**.

## Context lifespans

The lifespans list shows every item across the whole session, on a call axis that does not change with the River's zoom, with compaction boundaries marked. Search matches item labels and the first 120 characters of their previews. You can filter by kind, limit the list to items present at the pinned call, and sort by token-turn exposure, size, first appearance or lifetime. Size uses one shared token-estimate profile, the one with the most estimates; items without an estimate sort last. With no filters, the heading shows the total item count; with filters, it shows how many of them match.

Click a point on an item's segment to select the item and pin the nearest call within that segment. Clicking an item's label, or pressing Enter or Space on it, selects the item and keeps the current pin. Items that were in no call's context, such as a summary written at the very end of a session, can still be selected. None of these switch views or move the River.

Versions of an item share one row, with a mark at each change; clicking a segment selects that version.

## The inspector

On wide screens the River and the lifespans list share the main column, and the call and item inspector appears beside them only while a call or item is selected. Key values and actions stay visible; usage breakdowns, token diagnostics, profiles and identifiers are in disclosures, which stay open or closed as you left them for the rest of the session. **Copy** buttons say when an ID has been copied.

The item inspector shows "version N of M" for a versioned item and lists every version with its calls and tokens. For each new system prompt version, it says what changed at that call: tools added, tool definitions changed or tools removed, or otherwise that the prompt text changed.

**View details** scrolls to the selected item's summary in the inspector and focuses it, or focuses the inspector's prompt when nothing is selected. Hovering and selecting never open or scroll the inspector by themselves.

## View links

**Copy view link** copies a link to what you are looking at. The link records:

- the session, as a short reference such as `pi-a83f9c2d71b4` (the harness and a hash of the native session ID);
- the River or Composition view, and the River's display mode (`display=items` or `display=itemTypes`);
- the Composition scope;
- the approximate visible call range;
- the pinned call and the selected item.

Reloading the page, or going Back or Forward, restores the view. If something in a link no longer exists, Highwater says so instead of selecting something else, and it refuses a session reference that matches more than one session.

Panning and zooming update the current history entry; other navigation can add entries. A link carries opaque identifiers, not session content or local paths, and does not give anyone access to the session. A display mode in the link overrides your saved one; without one, your saved preference applies (Items by default). Opening a link does not change your saved preferences. If the browser blocks the clipboard, the link appears in a field you can copy by hand. Copied links leave out URL credentials and unused query parameters.

## Escape and preferences

Escape closes the innermost open thing first: a disclosure or popover, then an economics event breakdown, then the **Cache & cost** track (focus returns to its toggle). After that, each press clears the selected item, then the pinned call, then returns to Fit all. **Clear selection** clears the item and the pin at once.

Your River and Cache & cost choices are remembered across sessions and reloads, in one small entry in the browser's local storage that holds only settings, never session names, content or selections. To go back to the River's defaults, choose **Session scale** and **Items**. If the browser blocks storage, everything still works for the current visit.
