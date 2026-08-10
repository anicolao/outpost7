import type { GameState, Card, PlayerColor } from '../types';
import { createSeededRandom, type RandomSource } from '../random';
import { DEFAULT_GAME_SETTINGS, type GameSettings } from '../settingsStore';
import { calculateRepairCubes } from '../repairRules';
import { evaluateStrategicPlacement } from './strategy';

type AISettings = Pick<
    GameSettings,
    | 'SALVAGE_MAX_COST'
    | 'CUBES_PER_PLAY'
    | 'CUBES_PER_COLOR_MATCH'
    | 'CUBES_PER_OVERPAYMENT'
    | 'MAX_HAND_SIZE'
    | 'ALLOW_ZERO_CUBE_REPAIRS'
>;

const DEFAULT_AI_SETTINGS: AISettings = DEFAULT_GAME_SETTINGS;

// Move Actions
type MoveAction =
    | { type: 'PASS' }
    | { type: 'SALVAGE', cardIds: string[] }
    | { type: 'REPAIR', playCardId: string, payCardId: string, row: number, col: number }
    | { type: 'RESOLVE_BONUS', bonusId: string };

export class BasicAI {
    private readonly random: RandomSource;

    constructor(
        private playerColor: PlayerColor,
        seed: string,
        private readonly settings: AISettings = DEFAULT_AI_SETTINGS,
    ) {
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
        let maxScore = Number.NEGATIVE_INFINITY;

        // Iterate all possible Play/Pay pairs
        for (let i = 0; i < hand.length; i++) {
            for (let j = 0; j < hand.length; j++) {
                if (i === j) continue;

                const playCard = hand[i];
                const payCard = hand[j];

                if (payCard.cost < playCard.cost) continue; // Invalid payment
                const cubes = calculateRepairCubes(playCard, payCard, this.settings);
                if (cubes === 0 && !this.settings.ALLOW_ZERO_CUBE_REPAIRS) continue;

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
        let score = this.evaluateRepairOutcome(playCard, payCard);

        score += evaluateStrategicPlacement(
            state,
            playCard,
            payCard,
            r,
            c,
            this.playerColor,
            this.settings,
        );

        return score;
    }

    private evaluateRepairOutcome(playCard: Card, payCard: Card): number {
        const cubes = calculateRepairCubes(playCard, payCard, this.settings);
        let score = cubes * 100;

        if (playCard.bonuses) {
            for (let i = 1; i <= cubes; i++) {
                if (playCard.bonuses[i]) {
                    const type = playCard.bonuses[i].type;
                    if (type === 'ADD_CUBE') score += 40;
                    if (type === 'REMOVE_CUBE') score += 40;
                    if (type === 'ADD_POPULATION') score += 30;
                }
            }
        }

        // A payment card leaves the game. When two payments produce the same
        // outcome, preserve the more valuable card for a future repair.
        score -= payCard.cost;

        return score;
    }

    private findBestSalvageMove(state: GameState, hand: Card[]): MoveAction | null {
        const spaces = this.settings.MAX_HAND_SIZE - hand.length;
        if (spaces <= 0) return null;

        let bestPlans: Card[][] = [];
        let bestScore = Number.NEGATIVE_INFINITY;

        // The configurable offer is deliberately bounded, so evaluating every
        // non-empty subset is both exhaustive and inexpensive.
        for (let mask = 1; mask < (1 << state.offer.length); mask++) {
            const cards = state.offer.filter((_, index) => mask & (1 << index));
            const cost = cards.reduce((total, card) => total + card.cost, 0);
            if (cards.length > spaces || cost > this.settings.SALVAGE_MAX_COST) continue;

            const futureHand = [...hand, ...cards];
            const score = this.evaluateHandPlan(futureHand) * 1000
                + this.countProductiveRepairs(futureHand) * 10
                - cards.length;

            if (score > bestScore) {
                bestScore = score;
                bestPlans = [cards];
            } else if (score === bestScore) {
                bestPlans.push(cards);
            }
        }

        if (bestPlans.length === 0) return null;

        const selected = bestPlans[Math.floor(this.random() * bestPlans.length)];
        return { type: 'SALVAGE', cardIds: selected.map(card => card.id) };
    }

    private evaluateHandPlan(hand: Card[]): number {
        const memo = new Map<number, number>();

        const bestScore = (available: number): number => {
            if (available === 0) return 0;
            const cached = memo.get(available);
            if (cached !== undefined) return cached;

            const first = hand.findIndex((_, index) => available & (1 << index));
            const withoutFirst = available & ~(1 << first);
            let best = bestScore(withoutFirst);

            for (let other = first + 1; other < hand.length; other++) {
                if (!(available & (1 << other))) continue;
                const remaining = withoutFirst & ~(1 << other);

                if (hand[other].cost >= hand[first].cost) {
                    best = Math.max(
                        best,
                        this.evaluateRepairOutcome(hand[first], hand[other]) + bestScore(remaining),
                    );
                }
                if (hand[first].cost >= hand[other].cost) {
                    best = Math.max(
                        best,
                        this.evaluateRepairOutcome(hand[other], hand[first]) + bestScore(remaining),
                    );
                }
            }

            memo.set(available, best);
            return best;
        };

        return bestScore((1 << hand.length) - 1);
    }

    private countProductiveRepairs(hand: Card[]): number {
        let count = 0;
        for (let play = 0; play < hand.length; play++) {
            for (let pay = 0; pay < hand.length; pay++) {
                if (play === pay || hand[pay].cost < hand[play].cost) continue;
                if (this.evaluateRepairOutcome(hand[play], hand[pay]) > 0) count++;
            }
        }

        return count;
    }
}
