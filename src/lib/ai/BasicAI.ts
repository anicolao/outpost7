import type { GameState, Card, PlayerColor } from '../types';
import { hasValidMoves, evaluateOwnership } from '../gameUtils';
import { createSeededRandom, type RandomSource } from '../random';

// Move Actions
type MoveAction =
    | { type: 'PASS' }
    | { type: 'SALVAGE', cardIds: string[] }
    | { type: 'REPAIR', playCardId: string, payCardId: string, row: number, col: number }
    | { type: 'RESOLVE_BONUS', bonusId: string };

export class BasicAI {
    private readonly random: RandomSource;

    constructor(private playerColor: PlayerColor, seed: string) {
        this.random = createSeededRandom(seed, `basic-ai:${playerColor}`);
    }

    public computeMove(state: GameState): MoveAction {
        // 0. Handle Bonuses (Highest Priority)
        // If there are pending bonuses, we MUST resolve them before doing anything else.
        if (state.pendingBonuses.length > 0) {
            // Picking the first one is a simple greedy strategy.
            // In future, we could prioritize certain bonuses.
            return {
                type: 'RESOLVE_BONUS',
                bonusId: state.pendingBonuses[0].id
            };
        }

        // Ensure it's our turn
        if (state.currentTurn !== this.playerColor) {
            console.warn("AI: Not my turn!");
            return { type: 'PASS' };
        }

        const hand = state.hands[this.playerColor];

        // 1. Try to REPAIR first (Greedy Preference)
        // If we can make a good move, do it.
        const bestRepair = this.findBestRepairMove(state, hand);
        if (bestRepair) {
            return bestRepair;
        }

        // 2. If no good repair, try to SALVAGE
        const bestSalvage = this.findBestSalvageMove(state, hand);
        if (bestSalvage) {
            return bestSalvage;
        }

        // 3. Otherwise, PASS (should only happen if strictly no legal moves)
        return { type: 'PASS' };
    }

    private findBestRepairMove(state: GameState, hand: Card[]): MoveAction | null {
        if (hand.length < 2) return null;

        let bestMoves: MoveAction[] = [];
        let maxScore = -1;

        // Iterate all possible Play/Pay pairs
        for (let i = 0; i < hand.length; i++) {
            for (let j = 0; j < hand.length; j++) {
                if (i === j) continue;

                const playCard = hand[i];
                const payCard = hand[j];

                if (payCard.cost < playCard.cost) continue; // Invalid payment

                // Iterate all Grid Positions
                for (let r = 0; r < state.grid.length; r++) {
                    for (let c = 0; c < state.grid[r].length; c++) {
                        if (this.isValidPlacement(state, r, c)) {
                            // Evaluate this move
                            const score = this.evaluateMove(state, playCard, payCard, r, c);
                            if (score > maxScore) {
                                maxScore = score;
                                bestMoves = [{
                                    type: 'REPAIR',
                                    playCardId: playCard.id,
                                    payCardId: payCard.id,
                                    row: r,
                                    col: c
                                }];
                            } else if (score === maxScore) {
                                bestMoves.push({
                                    type: 'REPAIR',
                                    playCardId: playCard.id,
                                    payCardId: payCard.id,
                                    row: r,
                                    col: c
                                });
                            }
                        }
                    }
                }
            }
        }

        if (bestMoves.length === 0) return null;

        return bestMoves[Math.floor(this.random() * bestMoves.length)];
    }

    private isValidPlacement(state: GameState, r: number, c: number): boolean {
        // Spot must be empty
        if (state.grid[r][c] !== null) return false;

        // Must be adjacent to existing OR grid is empty
        let gridEmpty = true;
        for (let row of state.grid) {
            for (let cell of row) {
                if (cell) gridEmpty = false;
            }
        }
        if (gridEmpty) return true;

        const neighbors = [
            state.grid[r - 1]?.[c],
            state.grid[r + 1]?.[c],
            state.grid[r]?.[c - 1],
            state.grid[r]?.[c + 1]
        ];
        return neighbors.some(n => n !== undefined && n !== null);
    }

    private evaluateMove(state: GameState, playCard: Card, payCard: Card, r: number, c: number): number {
        // Heuristic Score
        // 1. Cubes placed (Immediate Control)
        // 2. Bonuses triggered (Approximation)

        // Calculate Cubes
        // Hardcoded constants mirroring settingsStore default for now, or pass settings?
        // Let's assume defaults: 1 base, 1 match, 1 per overpay
        const CUBES_PER_PLAY = 1;
        const CUBES_PER_COLOR_MATCH = 1;
        const CUBES_PER_OVERPAYMENT = 1;

        const colorMatch = payCard.color === playCard.color ? CUBES_PER_COLOR_MATCH : 0;
        const overpay = Math.max(0, payCard.cost - playCard.cost);
        const cubes = CUBES_PER_PLAY + colorMatch + (overpay * CUBES_PER_OVERPAYMENT);

        let score = cubes * 10;

        // Bonus Analysis (Simple)
        if (playCard.bonuses) {
            for (let i = 1; i <= cubes; i++) {
                if (playCard.bonuses[i]) {
                    // Bonus triggered!
                    const type = playCard.bonuses[i].type;
                    if (type === 'ADD_CUBE') score += 5; // Good
                    if (type === 'REMOVE_CUBE') score += 5; // Good
                    if (type === 'ADD_POPULATION') score += 2; // Okay
                }
            }
        }

        // Strategic Placement (Very Basic)
        // Prefer rows/cols where we are losing? Or winning?
        // For now just random preference via order.

        return score;
    }

    private findBestSalvageMove(state: GameState, hand: Card[]): MoveAction | null {
        // Greedy: Take as many cards as possible up to limit 7 and cost 12.

        const currentHandSize = hand.length;
        const spaces = 7 - currentHandSize;
        if (spaces <= 0) return null; // Hand full

        const offer = state.offer;
        // Sort offer by cost ascending (cheapest first)
        const sortedOffer = [...offer].sort((a, b) => a.cost - b.cost);

        const toTake: string[] = [];
        let currentCost = 0;

        for (const card of sortedOffer) {
            if (toTake.length < spaces && currentCost + card.cost <= 12) {
                toTake.push(card.id);
                currentCost += card.cost;
            }
        }

        if (toTake.length > 0) {
            return {
                type: 'SALVAGE',
                cardIds: toTake
            };
        }

        return null; // Cannot take anything?
    }
}
