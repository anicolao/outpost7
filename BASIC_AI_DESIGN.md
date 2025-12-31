# Basic AI Design: "The Scrapper"

## Overview
This document outlines a design for a basic AI player for *Outpost Seven*. The goal is to create an opponent that plays fast, follows all rules, and offers a moderate challenge for beginner to intermediate players. The AI will primarily use a **Greedy Strategy** with a **1-ply lookahead** (evaluating the immediate result of its move).

## Design Goals
1.  **Speed**: Decisions should be made in under 1 second.
2.  **Competence**: The AI should prioritize winning votes (the victory condition) over just placing random pieces.
3.  **Simplicity**: Stateless design where possible; looks at the current board to decide the next move.

---

## 1. AI Architecture

The AI will be implemented as a function or class that takes the current `GameState` and returns a `Move`.

```typescript
type Move = 
  | { type: 'PASS' }
  | { type: 'SALVAGE', cardIds: string[] }
  | { type: 'REPAIR', playCardId: string, position: {r: number, c: number}, discardCardId: string };

interface AIPlayer {
  computeMove(gameState: GameState): Move;
}
```

## 2. Decision Logic

The AI follows a strict priority hierarchy:
1.  **Can I win right now?** (Not applicable usually as points are tallied at end, but roughly "Maximize Vote Count").
2.  **Should I Repair (Play)?** If I have valid moves that improve my position significantly.
3.  **Should I Salvage (Draw)?** If I cannot play, or playing is sub-optimal (e.g., waste high cards for low gain), or my hand is empty.
4.  **Must I Pass?** If neither Repair nor Salvage is legal.

### Evaluation Function (Scoring a State)
To make choices, the AI needs to score how "good" a game state is for itself.

`Score = (MyWinningPopulation * 100) + (MyTotalCubes * 1) + (MyHandQuality * 0.1)`

*   **MyWinningPopulation**: Sum of population in rows/cols where the AI currently holds the Vote Token.
*   **MyTotalCubes**: Total number of repair cubes on the board (tiebreaker).
*   **MyHandQuality**: Tiny weight to prefer keeping high-value cards or diverse colors if all else is equal.

---

## 3. Detailed Algorithms

### A. Repair Logic (Playing a Card)
The AI iterates through all legal *Repair* moves:

1.  **Identify Candidates**:
    *   For each card in Hand (`C_play`):
    *   For each valid grid coordinate (`Pos`): (must be adjacent to existing, within 5x5).
    *   For each potential discard card in Hand (`C_discard`): (must be valid cost).

2.  **Simulation**:
    *   Simulate placing `C_play` at `Pos` consuming `C_discard`.
    *   **Handle Bonuses**: If the move triggers a bonus, greedily apply it:
        *   *Add Cube*: Add to the most valuable row/col owned or contested.
        *   *Remove Cube*: Remove from opponent's stronghold row/col.
        *   *Add Pop*: Add to a row/col where AI is winning or close to winning.

3.  **Selection**:
    *   Pick the move that results in the highest `Score`.
    *   *Threshold*: Only play if the move adds at least X value (e.g., don't waste a card just to place 0 cubes unless necessary).

### B. Salvage Logic (Drawing Cards)
If Repair is not chosen, the AI attempts to Salvage.

1.  **Goal**: Fill hand with useful cards without exceeding hand limit (7).
2.  **Constraint**: Sum of values <= 12.
3.  **Selection**:
    *   Find all valid subsets of the Market cards.
    *   **Heuristic**: Prefer largest subset size (more cards). Break ties by sum of values (higher numbers are better for paying costs).
    *   *Optimization*: If Hand is empty, prioritize getting at least one high card (4 or 5) and one low card (1 or 2).

### C. Pass Logic
If no Repair moves are possible (hand empty or no valid spots/discards) AND no Salvage moves are possible (market empty or hand full), then `PASS`.

---

## 4. Implementation Phasing

### Phase 1: The "Random" Mover (Foundation)
*   Implement `getLegalMoves()`.
*   Pick a random legal move.
*   *Purpose*: Verify game rules, end-of-game dection, and basic AI hookup.

### Phase 2: The "Greedy" Mover
*   Implement the `Score` function focusing only on **Cubes Placed**.
*   AI simply maximizes cubes placed per turn.

### Phase 3: The "Strategist" (Final Basic AI)
*   Update `Score` function to care about **Population Votes**.
*   AI targets rows/columns with high population.
*   AI uses bonuses to swing votes.

## 5. Technical Considerations
*   **Performance**: The branching factor for Repair can be high (~7 cards * ~10 spots * ~6 discards = ~420 combinations). This is trivial for modern JS to compute in ms.
*   **State Immutability**: Since the game state is implemented with Redux, each action returns a new state. The AI can safely dispatch actions to evaluate moves without affecting the current game state.
*   **Async**: Computation should be wrapped in a microtask or generally non-blocking if it takes >16ms (unlikely for this complexity).
*   **Determinism**: AI should ideally be deterministic (seeded random) for debugging, or random for variety.

## 6. Future Improvements (Advanced AI)
*   **Opponent Modeling**: "If I do X, opponent can do Y." (Minimax/Alpha-Beta).
*   **Resource Denying**: Drafting cards solely to prevent the opponent from getting them.
*   **Setup Strategy**: Intelligent initial placement of Voting Tokens and Population (if variable).
