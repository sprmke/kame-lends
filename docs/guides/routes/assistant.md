# Ask Kame (`/assistant`, panel)

Read-only conversational assistant. Ask about balances, dues, interest, payments, parties, bank loans, groups, and your own commission. Answers show working steps, tables, source links, and an expandable calculation. Nothing is ever saved by the assistant.

Architecture: [`docs/architecture/ai-assistant.md`](../architecture/ai-assistant.md). Platform: [`ai-platform.md`](../architecture/ai-platform.md).

## Surfaces

| Surface          | Behavior                                                                                                                                                                                        |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Desktop launcher | Floating **Ask** button bottom-right (also `⌘/Ctrl + J`). Opens a 26rem right-docked panel. At 1280px+ the app shell makes room (`html.assistant-docked`). The panel chunk loads on first open. |
| Phone            | **Ask** button above the dock opens a full-height bottom sheet. The composer respects the safe area and the on-screen keyboard.                                                                 |
| Full page        | `/assistant` and `/assistant/[conversationId]`. History rail at `lg+`, sheet history on phone. Deep-linkable.                                                                                   |
| Hidden when      | `GET /api/ai/status` reports `assistant_chat: false`, the user is signed out, or the account is outside `AI_ASSISTANT_ROLLOUT`. The nav item is filtered out when disabled.                     |
| Offline          | The launcher stays visible but the composer POST returns the service worker's offline JSON; the panel shows the error. Conversations are never cached.                                          |

## A turn

1. You type a question (or pick a quick tool / starter). Optional pins (`@` a borrower, investor, loan, or the button) narrow the context. Max 8 pins. Pins are saved on the thread and re-applied when you reload, reopen, or regenerate.
2. Enter sends; Shift+Enter adds a line; Esc closes the sheet or stops a running answer.
3. Live steps appear: understanding → looking up → computing → writing → checking.
4. The answer streams. Numbers come from tools, not the model.
5. Blocks follow: stats, a loan/party card, up to two tables (sortable, CSV copy, row links), an expandable **How I calculated this**, caveats, source chips, and follow-up chips.
6. Actions: copy, regenerate, 👍/👎. Stop cancels the request and the provider call.

## States

Empty (four role/page-aware starters + privacy line) · thinking · streaming · tool failed (step shows the reason, answer continues) · partial (table note) · needs clarification (choice chips) · no data · fallback card (verifier) · rate limited / busy · daily cap · AI off / rollout · offline · unauthorized · stopped.

## Composer

- Quick tools gallery (grouped: Loans, Money, People, Tools). Tools that need a borrower/investor/loan open the pin picker first.
- Attachment: photo, camera, paste, or file. Compressed with the receipt path, processed in memory, never saved. Read by the receipt pipeline; “is this recorded?” matches reference numbers.
- Voice: Web Speech API, feature-detected. The mic hides when unsupported. A first-use note explains that the browser may send audio to its speech service. Permission-denied shows a settings hint.
- Page context chip (`Viewing Loan #12`) is display-only; explicit pins win.
- Price visibility: when the eye toggle is on, amounts and percentages in the thread, tables, stats, and the breakdown are masked. Names, dates, counts, and statuses stay visible.

## History

Drawer on phone, rail on the full page. Today / Yesterday / Earlier. Open, rename, delete, clear all, search by title. Titles come from the first message (no model call). Threads are per-user and deletable. Retention is 90 days by default.

## Permissions

The assistant adds no access rules. It uses the same loaders as the screens:

- Owner: every loan they own plus loans where they are investor, borrower, or witness.
- Investor / borrower / witness: only their linked loans, read-only.
- Group-only viewer: only group loans, through the redacted projection (no contact details, notes, receipts, signatures, or contract).
- Commission: the viewer's own row only.
- Data health: workspace owner only.
- Any forged id returns “not visible”, never data.

## Implementation map

| Concern                             | Path                                                                     |
| ----------------------------------- | ------------------------------------------------------------------------ |
| SSE endpoint                        | `src/routes/api/ai/assistant/+server.ts`                                 |
| Conversations / feedback / mentions | `src/routes/api/ai/assistant/**`                                         |
| Agent loop and guards               | `src/lib/server/ai/agent/**`                                             |
| Read-only tools                     | `src/lib/server/ai/tools/**`                                             |
| Viewer data (shared loaders)        | `src/lib/server/assistant/viewer-data.ts`                                |
| Persistence                         | `src/lib/server/ai/assistant/store.ts`                                   |
| Prompt                              | `src/lib/server/ai/prompts/assistant-chat.ts`                            |
| Client store / parser               | `src/lib/assistant/store.svelte.ts`, `stream.ts`, `quick-tools.ts`       |
| Components                          | `src/lib/components/assistant/**`                                        |
| Panel + launcher                    | `AssistantPanel.svelte`, `AssistantLauncher.svelte`                      |
| Full page                           | `src/routes/assistant/**`                                                |
| Nav item                            | `src/lib/nav/app-nav.ts` (`ASSISTANT_ITEM`), filtered by `useAiStatus()` |

## Edge cases

- Two similar names → ask, never guess.
- No match → closest names, no substitute.
- Deleted records are excluded.
- Overpayment shows “overpaid by”, not a negative balance.
- A manual Completed override carries a caveat.
- Unlinked payments carry the D-14 caveat.
- Dates use Asia/Manila; a loan due today is not overdue until tomorrow.
- Amounts and counts inside prose must be fact tokens; a model-typed number triggers one regenerate, then the factual fallback.
- A stream drop after `turn_started` reloads the persisted thread.
- Two tabs: the per-isolate live-stream guard returns “already running”.
- Image too large or wrong type → inline error, no request.
- Hide-prices on → masked amounts everywhere in the thread.
- Reduced motion → no shimmer or panel animation.
