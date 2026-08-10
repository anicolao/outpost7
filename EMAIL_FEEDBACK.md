# Email Feedback Review

This document compares the “Customizability for Outpost 7” email thread
(December 27, 2025–January 2, 2026) with the repository after the authoritative
settings changes in this PR, based on `main` commit `8a029d8` on August 10,
2026. It reflects the implementation and tests, not a fresh
browser-compatibility test of the production deployment.

Status meanings:

- **Closed** — implemented, or the thread reached a decision that the current
  implementation follows.
- **Partial** — some of the requested behavior exists, but an important part is
  missing, disconnected, or not adequately covered.
- **Open** — the current code does not implement the requested behavior, or it
  still implements the reported bug.
- **Deferred** — discussed as a possible variation or future expansion, without
  a present commitment to implement it.

## Feedback summary

Stefan's overall beta feedback was strongly positive: the game was intuitive,
playable through to completion, and useful for quickly playing solo. The thread
then identified four main areas for further work:

1. Make balance experiments cheap by allowing replacement card data and exposing
   the important setup and rule constants.
2. Correct several rules bugs involving cube capacity, removal, neutral plays,
   and tied majorities.
3. Improve legibility and platform behavior, especially AI-turn feedback,
   counters, disabled-card styling, Safari tab restoration, and device sleep.
4. Improve the AI's immediate placement and salvage choices without necessarily
   turning it into a deep competitive opponent.

The card-set workflow and the three proposed AI improvements are now substantial
features. Cube capacity, tied ownership, the stray discard control, and the
settings-to-rules mapping have also been addressed. The largest remaining
questions are the intended default opening-hand count (the email says 7 while
the digital game has used 5), direct removal-lock regression coverage, and the
platform/legibility feedback.

## Card rendering and card-set customization

| Status | Feedback or decision | Current state | Remaining action |
| --- | --- | --- | --- |
| **Open** | Make the cube areas about 15% larger, with the sixth area reaching the bottom of a value-6 card. | `Card.svelte` still uses the cube-slot layout present when the first email was sent: a 30%-wide column at `top: 6%`, `right: 8%`, with a 4px gap. Later work enlarged whole cards and standardized tabletop/offer card sizes, but did not implement or test this requested cube-area change. | Enlarge the cube-slot artwork/layout and add inspected visual baselines for value-3 through value-6 cards. |
| **Closed** | Replace the deck by pasting the spreadsheet's `cards` sheet. | The Card Library accepts TSV or CSV, validates the required columns and minimum playable deck, and previews the resulting cards. | None for the basic import workflow. |
| **Closed** | Keep uploaded revisions such as `v49` available and choose the active set. | Named card sets are stored as immutable Firestore documents. The library lists bundled and uploaded sets, previews each set, and selects the set used by the next game. The active selection is remembered in local storage. Uploaded sets are shared with authenticated visitors rather than privately owned by a durable account. | None for the requested shared persistent library. A future product decision could add ownership/edit/delete semantics. |
| **Open** | Let starting border cards carry resource colours and count those colours when a population bonus is resolved. | Imported start rows can contain `module_resource_1`, but `PopulationCard` retains only its image, population count, and owner. `ADD_POPULATION` counts colours only on module cards in the grid. The bundled start rows are also colourless. | Preserve a start card's colour in game state and include the relevant row/column header colour in population-bonus calculation. Add rule and E2E coverage. |

Relevant implementation: `src/components/CardsModal.svelte`,
`src/lib/cardLoader.ts`, `src/lib/card-set-repository.ts`, `src/App.svelte`, and
`src/components/Card.svelte`.

## Settings and setup variables

| Status | Feedback or decision | Current state | Remaining action |
| --- | --- | --- | --- |
| **Closed** | Expose the existing salvage and cube-production constants. | One rules snapshot is stored in `GameState`. Salvage and cube settings govern the tabletop, reducer validation, valid-move checks, private controller, and AI. | None. |
| **Closed** | Maximum hand size, currently 7. | `MAX_HAND_SIZE` defaults to 7 and governs salvage, valid moves, reducer checks, AI capacity, private-hand discard/display, and responsive landscape card sizing. | None. |
| **Partial** | Grid dimensions from 3–6 per side, default 5×5. | Row and column controls now have explicit 2–6 bounds, setup snapshots both dimensions, and tabletop sizing derives from them. Existing visual coverage exercises 2×2 through 5×5. | Confirm whether the digital 2×2 test mode should remain user-visible, then add a 6×6 visual/gameplay case and require enough imported headers for that maximum. |
| **Partial** | Starting cards in each player's hand, stated as 7. | `STARTING_HAND_SIZE` now governs both opening deals and defaults to the digital game's existing value of **5**. The mapping is fixed, but the email's stated default of 7 has not been reconciled with the later digital-game behavior. | Confirm whether the default should remain 5 or change to 7; no code-path disconnection remains. |
| **Closed** | Initial hand value retained: 12 for player one and 16 for player two. | Both configured values are snapshotted into the game and sent in every Firebase hand update. The private controller uses the appropriate player limit, and the host accepts a discard only when it brings the active player's opening hand within the configured value and count limits. | None. |
| **Closed** | Cards discarded from the top before setup, currently 10. | `BURN_CARD_COUNT` controls deterministic deck setup and defaults to 10. | None. |
| **Closed** | Face-up module cards, currently 5. | `OFFER_SIZE` controls initial deal, refill, tabletop rendering and sizing, and defaults to 5. The AI enumerates the actual offer rather than assuming five cards. | None. |
| **Closed** | Allow or disallow playing a card with zero cubes, default disallowed. | `ALLOW_ZERO_CUBE_REPAIRS` defaults to false and is enforced by the reducer, valid-move checks, private controller, and AI. When explicitly enabled, the placed zero-cube card is neutral rather than incorrectly owned. | None for the supported toggle. |

The settings are now copied into immutable game configuration when play starts;
later edits to the lobby store cannot change a live match. A documented E2E
scenario verifies all 13 controls, custom setup counts, tabletop limits, and the
rules received by a Firebase-connected private hand.

## Rules and reported bugs

| Status | Feedback or decision | Current state | Remaining action |
| --- | --- | --- | --- |
| **Partial** | Cube removal sometimes removed only some cubes because excess invisible cubes could be placed beyond a card's actual slots. | Repair cube production is capped by `maxCubes`, and add-cube bonuses also stop at `maxCubes`, addressing the identified invisible-cube cause. There are tests for capacity and ordinary removal, but no focused regression reproduces the full reported removal failure across several cards and slot capacities. | Add a regression test that overpays a low-capacity card, then resolves removal through the affected row and column. Close fully if that reproducer stays green. |
| **Closed** | A bonus cube locks the cubes beyond it against removal; do not skip the bonus to remove another cube. | Removal checks the outermost occupied cube slot. If that slot is a bonus, it removes nothing; it never searches past the protected slot. This follows Stefan's confirmed rule. | Add a direct unit test for the lock, because the current removal test covers only a card without a protected bonus. |
| **Closed** | The opponent played a card without a cube; the final preference was to disallow this uncommon neutral play. | Zero-cube repair is disallowed by default at the reducer boundary and in all move-selection paths. The explicit experimental setting enables the rare neutral play without assigning ownership. | None unless the optional rule is removed entirely. |
| **Closed** | Row or column ownership must change only when the challenger strictly exceeds the current cube count, not on a tie. | `evaluateOwnership` changes ownership only for strict red or yellow majorities and otherwise preserves the previous owner. A unit test explicitly checks that a tie does not flip ownership. | None unless another production trace contradicts the covered rule. |
| **Closed** | The unexplained Discard button reset selection and had no useful function. | The duplicate/non-contextual discard action is gone. The footer now shows `Confirm Discard` only while the player is actually over an opening or hand-size limit, plus a separate `Clear` action. E2E tests cover opening and later hand-limit discards. | None. |

## Usability and platform feedback

| Status | Feedback or decision | Current state | Remaining action |
| --- | --- | --- | --- |
| **Partial** | AI turns were too instantaneous to understand; show which cards it takes and the effect/order of bonuses. | Production AI actions are paced by 500ms and human tabletop plays/bonus clicks have 600ms animations. The AI dispatches repairs, salvages, and bonuses directly, however, so it does not use the face-down-card flight/bonus execution path and there is no action history or explicit “AI took these cards” display. | Add a small event-driven AI action queue or visible action log using real transition completion events. Animate or otherwise identify repairs, salvaged cards, and resolved bonuses without arbitrary longer sleeps. |
| **Partial** | Show deck size and each player's hand size; Alex also proposed discard-pile size. | A private controller shows its own `Cards: n/configured maximum`. The offer shows the active player's prospective hand count only while cards are selected. Deck count, discard count, persistent tabletop hand counts, and the opponent's hand count are absent. | Add tabletop counters for deck, discard, red hand, and yellow hand; keep private card identities hidden. |
| **Open** | Disabled cards are so grey that their resource colour is hard to read. | Disabled private cards still use `opacity: 0.3` and `filter: grayscale(1)`, which directly preserves the reported problem. | Replace grayscale with a colour-preserving disabled treatment such as an overlay, border, lock mark, or reduced brightness. Add mobile visual coverage for mixed enabled/disabled hands. |
| **Open** | Safari on macOS showed a black game screen for 1–5 seconds after returning to the tab. | There is no Safari/WebKit E2E project, visibility-change handling, or recorded workaround. | Reproduce in current Safari, determine whether canvas/compositing, backdrop filtering, or page restoration is responsible, and add WebKit coverage where practical. |
| **Open** | A phone displaying a hand went to sleep during play. | The application does not use the Screen Wake Lock API or provide a keep-awake control. Stefan's test used a separate laptop window, so the original phone scenario was not narrowed down further in the thread. | Add an opt-in wake lock for the private hand while connected, with release/reacquisition on visibility changes and a graceful unsupported-browser state. |
| **Closed (later work)** | Keep the private phone hand non-scrolling and usable around mobile browser chrome. | Later responsive-layout work uses `100dvh`, safe-area padding, and visual tests for mobile card size and bottom-button accessibility. | Continue to preserve this behavior when changing disabled-card styling or discard controls. |

## AI feedback

Stefan suggested exhaustive immediate move evaluation, choosing the move that
maximizes score swing, salvaging when no worthwhile repair exists, and choosing
salvage cards that build a strong single-colour hand. The current AI goes beyond
its original “take more cards and maximize cube bonuses” heuristic:

| Status | Feedback or decision | Current state | Remaining action |
| --- | --- | --- | --- |
| **Closed** | Try every playable card/payment pair in every legal board space. | `BasicAI` exhaustively enumerates all play cards, payment cards, and valid placements, with seeded tie-breaking. | None. |
| **Partial** | Evaluate the resulting score swing and, ideally, play/rewind through normal game logic. | The AI projects placement, scores population-weighted ownership/margins, and considers the opponent's strongest next placement. This is meaningful one-ply strategy, but it uses a simplified projection rather than running and rewinding the normal reducer, so it does not simulate bonus resolution or a complete next turn. | If stronger play is wanted, expose a pure move simulation using the same reducer/rules, including bonuses, rather than duplicating more rules in AI code. |
| **Closed** | Improve salvage beyond “take the most cards,” favoring a useful colour/repair plan. | The AI evaluates every affordable offer subset and uses dynamic programming to value the best sequence of future play/payment pairs. Tests cover taking a matching card over a cheap filler and taking a complete useful pair. This is stronger than the suggested single-colour-total heuristic. | None for the stated heuristic; future tuning can adjust its repair-versus-salvage threshold. |

AI usability remains separate from AI strength. The strategy work is largely
closed, while communicating AI actions to a player remains partial.

## Recorded design decisions and deferred ideas

- **Turn flow remains hardcoded.** Alex explicitly did not plan to make Salvage,
  Repair, or their substeps configurable. No later message requested a general
  turn-flow editor.
- **Removal lock is the default rule.** Stefan confirmed that a bonus space locks
  the cubes beyond it. The older “skip the bonus and remove the next cube” rule
  was weaker and caused too many removals. Making that old interpretation a
  setting is deferred, not required.
- **Neutral plays should currently be disallowed.** The thread identified rare
  tactical reasons for them, but Stefan preferred omitting a rule that might
  matter only every 10–20 games. A future expansion with board-space bonus tokens
  could make neutral plays significant enough to revisit.
- **A highly competitive AI was not initially required.** Its primary purpose was
  solo UI testing and teaching. Later strategy work nevertheless implemented the
  concrete improvements proposed in the thread.
- **Coloured starting borders are a future rule option.** The data format can
  represent colour, but the game logic does not yet use it.

## Prioritized open actions

1. **Resolve the opening-hand discrepancy.** The email says 7; the configurable
   game default is 5. Confirm the intended default.
2. **Finish beta-test legibility work.** Add deck/discard/both-hand counts,
   preserve colour on disabled cards, and make AI actions observable.
3. **Complete card fidelity.** Enlarge the cube areas and teach population bonuses
   about coloured starting borders.
4. **Investigate platform behavior.** Re-test Safari tab restoration and add an
   opt-in wake lock for phone controllers.
5. **Strengthen regression coverage.** Add direct tests for protected removal and
   the original low-capacity/invisible-cube removal scenario.
