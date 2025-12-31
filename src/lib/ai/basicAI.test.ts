import { describe, it, expect } from 'vitest';
import { computeAIMove } from './basicAI';
import type { GameState, AIMove } from './basicAI';

describe('Basic AI', () => {
    it('should pass when no moves are available', () => {
        const state: GameState = {
            grid: [
                [null, null],
                [null, null]
            ],
            rowHeaders: [
                { card: 'start_1.svg', count: 1, owner: 'red' },
                { card: 'start_2.svg', count: 2, owner: 'yellow' }
            ],
            colHeaders: [
                { card: 'start_3.svg', count: 3, owner: 'red' },
                { card: 'start_1.svg', count: 1, owner: 'yellow' }
            ],
            hands: {
                red: [], // Empty hand
                yellow: []
            },
            offer: [],
            deck: [],
            currentTurn: 'red'
        };

        const move = computeAIMove(state);
        expect(move.type).toBe('PASS');
    });

    it('should salvage when hand is empty and offer has cards', () => {
        const state: GameState = {
            grid: [
                [null, null],
                [null, null]
            ],
            rowHeaders: [
                { card: 'start_1.svg', count: 1, owner: 'red' },
                { card: 'start_2.svg', count: 2, owner: 'yellow' }
            ],
            colHeaders: [
                { card: 'start_3.svg', count: 3, owner: 'red' },
                { card: 'start_1.svg', count: 1, owner: 'yellow' }
            ],
            hands: {
                red: [],
                yellow: []
            },
            offer: [
                { id: 'c1', cost: 3, color: 'blue', background: '', module_resource_1: '', text_module_resource_1: '', cube_1: '', cube_2: '', cube_3: '', cube_4: '', cube_5: '', cube_6: '', index: '1', bonuses: {} },
                { id: 'c2', cost: 5, color: 'green', background: '', module_resource_1: '', text_module_resource_1: '', cube_1: '', cube_2: '', cube_3: '', cube_4: '', cube_5: '', cube_6: '', index: '2', bonuses: {} }
            ],
            deck: [],
            currentTurn: 'red'
        };

        const move = computeAIMove(state);
        expect(move.type).toBe('SALVAGE');
        if (move.type === 'SALVAGE') {
            expect(move.cardIds.length).toBeGreaterThan(0);
        }
    });

    it('should repair when hand has valid cards', () => {
        const state: GameState = {
            grid: [
                [null, null],
                [null, null]
            ],
            rowHeaders: [
                { card: 'start_1.svg', count: 1, owner: 'red' },
                { card: 'start_2.svg', count: 2, owner: 'yellow' }
            ],
            colHeaders: [
                { card: 'start_3.svg', count: 3, owner: 'red' },
                { card: 'start_1.svg', count: 1, owner: 'yellow' }
            ],
            hands: {
                red: [
                    { id: 'c1', cost: 2, color: 'blue', background: '', module_resource_1: '', text_module_resource_1: '', cube_1: '', cube_2: '', cube_3: '', cube_4: '', cube_5: '', cube_6: '', index: '1', bonuses: {} },
                    { id: 'c2', cost: 4, color: 'blue', background: '', module_resource_1: '', text_module_resource_1: '', cube_1: '', cube_2: '', cube_3: '', cube_4: '', cube_5: '', cube_6: '', index: '2', bonuses: {} }
                ],
                yellow: []
            },
            offer: [],
            deck: [],
            currentTurn: 'red'
        };

        const move = computeAIMove(state);
        expect(move.type).toBe('REPAIR');
        if (move.type === 'REPAIR') {
            expect(move.playCardId).toBeTruthy();
            expect(move.discardCardId).toBeTruthy();
            expect(move.row).toBeGreaterThanOrEqual(0);
            expect(move.col).toBeGreaterThanOrEqual(0);
        }
    });

    it('should prefer high-value positions', () => {
        const state: GameState = {
            grid: [
                [null, null],
                [null, null]
            ],
            rowHeaders: [
                { card: 'start_1.svg', count: 3, owner: 'red' }, // High pop
                { card: 'start_2.svg', count: 1, owner: 'yellow' } // Low pop
            ],
            colHeaders: [
                { card: 'start_3.svg', count: 1, owner: 'red' },
                { card: 'start_1.svg', count: 1, owner: 'yellow' }
            ],
            hands: {
                red: [
                    { id: 'c1', cost: 2, color: 'blue', background: '', module_resource_1: '', text_module_resource_1: '', cube_1: '', cube_2: '', cube_3: '', cube_4: '', cube_5: '', cube_6: '', index: '1', bonuses: {} },
                    { id: 'c2', cost: 4, color: 'blue', background: '', module_resource_1: '', text_module_resource_1: '', cube_1: '', cube_2: '', cube_3: '', cube_4: '', cube_5: '', cube_6: '', index: '2', bonuses: {} }
                ],
                yellow: []
            },
            offer: [],
            deck: [],
            currentTurn: 'red'
        };

        const move = computeAIMove(state);
        expect(move.type).toBe('REPAIR');
        if (move.type === 'REPAIR') {
            // Should prefer row 0 (high population)
            expect(move.row).toBe(0);
        }
    });
});
