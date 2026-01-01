import { describe, it, expect } from 'vitest';
import reducer, { type GameState, playCard, resolveBonus } from './gameSlice';

// Helper to create a minimal valid state
const createInitialState = (): GameState => ({
    players: [
        { color: 'red', edge: 'bottom', type: 'human' },
        { color: 'yellow', edge: 'top', type: 'human' }
    ],
    phase: 'playing',
    orientation: 0,
    grid: Array(5).fill(null).map(() => Array(5).fill(null)),
    rowHeaders: [],
    colHeaders: [],
    deck: [],
    offer: [],
    discard: [],
    hands: { red: [], yellow: [] },
    currentTurn: 'red',
    turnCount: 1,
    pendingBonuses: [],
    finishedPlayers: [],
    winner: null,
    scores: { red: 0, yellow: 0 },
    bonusIdCounter: 0,
});

describe('Limit Checks', () => {
    it('should limit cubes to the cards maxCubes (3) when playing a card with massive overpayment', () => {
        let state = createInitialState();

        // Mock Settings
        const mockSettings = {
            CUBES_PER_PLAY: 1,
            CUBES_PER_COLOR_MATCH: 1,
            CUBES_PER_OVERPAYMENT: 1
        };

        // Hand setup
        const playCardItem = {
            id: 'play_1',
            index: '1',
            background: 'bg',
            module_resource_1: 'red_mod',
            text_module_resource_1: '0', // Cost 0
            cube_1: '1', cube_2: '2', cube_3: '3', cube_4: '', cube_5: '', cube_6: '', // ONLY 3 SLOTS
            maxCubes: 3, // EXPLICIT LIMIT
            cost: 0,
            color: 'red',
            bonuses: {}
        };
        const payCardItem = {
            id: 'pay_1',
            index: '2',
            background: 'bg',
            module_resource_1: 'red_mod',
            text_module_resource_1: '10', // Cost 10
            cube_1: '1', cube_2: '2', cube_3: '3', cube_4: '4', cube_5: '5', cube_6: '6',
            maxCubes: 6,
            cost: 10,
            color: 'red',
            bonuses: {}
        };

        state.hands.red = [playCardItem, payCardItem];

        // Play card: Cost 0, Pay with 10. Overpay = 10.
        // Cubes = 1 (base) + 1 (match) + 10 (overpay) = 12.
        // BUT maxCubes is 3.
        const action = playCard({
            color: 'red',
            playCardId: 'play_1',
            payCardId: 'pay_1',
            row: 0,
            col: 0,
            settings: mockSettings
        });

        state = reducer(state, action);

        expect(state.grid[0][0]).not.toBeNull();
        expect(state.grid[0][0]?.cubes).toBe(3); // Should be capped at 3
    });

    it('should ignore adding a cube to a card that is full (at maxCubes)', () => {
        let state = createInitialState();

        // Place a card with 3 cubes and maxCubes=3 at 0,1
        state.grid[0][1] = {
            id: 'target',
            index: '1',
            background: 'bg',
            module_resource_1: 'red_mod',
            text_module_resource_1: '0',
            cube_1: '1', cube_2: '2', cube_3: '3', cube_4: '', cube_5: '', cube_6: '',
            maxCubes: 3,
            cost: 0,
            color: 'red',
            bonuses: {},
            cubes: 3,       // FULL
            owner: 'red'
        };

        // Place a source card at 0,0 that triggers ADD_CUBE
        state.grid[0][0] = {
            id: 'source',
            index: '2',
            background: 'bg',
            module_resource_1: 'red_mod',
            text_module_resource_1: '0',
            cube_1: '1', cube_2: '2', cube_3: '3', cube_4: '4', cube_5: '5', cube_6: '6',
            maxCubes: 6,
            cost: 0,
            color: 'red',
            bonuses: {},
            cubes: 1,
            owner: 'red'
        };

        // Add pending bonus
        state.pendingBonuses = [{
            id: 'b1',
            definition: { type: 'ADD_CUBE' },
            sourceCardId: 'source',
            sourceRow: 0,
            sourceCol: 0,
            cubeSlot: 1
        }];

        // Resolve Bonus
        state = reducer(state, resolveBonus({ bonusId: 'b1' }));

        // Target at 0,1 should still be 3
        expect(state.grid[0][1]?.cubes).toBe(3);
    });
});
