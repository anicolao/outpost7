import { describe, it, expect, beforeEach } from 'vitest';
import gameReducer, {
    startGame,
    playCard,
    resolveBonus,
    type Card,
    type BonusInstance,
    type Edge,
    type PlayerColor,
    addPlayer
} from '../../src/lib/gameSlice';
import type { GameSettings } from '../../src/lib/settingsStore';

// Mock Data
const MOCK_SETTINGS: GameSettings = {
    SALVAGE_MAX_COST: 12,
    CUBES_PER_COLOR_MATCH: 1,
    CUBES_PER_PLAY: 1,
    CUBES_PER_OVERPAYMENT: 1,
    GRID_ROWS: 5,
    GRID_COLS: 5,
    STARTING_HAND_LIMIT_P1: 12,
    STARTING_HAND_LIMIT_P2: 16
};

const RED_PLAYER: { color: PlayerColor, edge: Edge } = { color: 'red', edge: 'bottom' };
const YELLOW_PLAYER: { color: PlayerColor, edge: Edge } = { color: 'yellow', edge: 'top' };

const CARD_NO_BONUS: Card = {
    id: 'c1',
    index: '1',
    background: 'blue.svg',
    module_resource_1: 'blue',
    text_module_resource_1: '5',
    cost: 5,
    color: 'blue',
    cube_1: '', cube_2: '', cube_3: '', cube_4: '', cube_5: '', cube_6: '',
    bonuses: {}
};

const CARD_WITH_BONUS: Card = {
    id: 'c2',
    index: '2',
    background: 'green.svg',
    module_resource_1: 'green',
    text_module_resource_1: '5',
    cost: 5,
    color: 'green',
    cube_1: 'bonus_add_cube', cube_2: '', cube_3: '', cube_4: '', cube_5: '', cube_6: '',
    bonuses: {
        1: { type: 'ADD_CUBE' }
    }
};

const CARD_PAY: Card = {
    id: 'pay1',
    index: '3',
    background: 'blue.svg',
    module_resource_1: 'blue',
    text_module_resource_1: '10',
    cost: 10,
    color: 'blue',
    cube_1: '', cube_2: '', cube_3: '', cube_4: '', cube_5: '', cube_6: '',
    bonuses: {}
};

describe('Bonus Logic', () => {
    // Helper to get a clean state (Immutable)
    const getBaseState = () => {
        let state = gameReducer(undefined, { type: 'unknown' });
        state = gameReducer(state, addPlayer(RED_PLAYER));
        state = gameReducer(state, addPlayer(YELLOW_PLAYER));
        state = gameReducer(state, startGame({ rows: 5, cols: 5, seed: 'test' }));
        return state;
    };

    it('should NOT end turn if bonus triggered', () => {
        const baseState = getBaseState();
        // Manually inject hands into a fresh state copy (simulating previous state)
        const state = {
            ...baseState,
            hands: {
                ...baseState.hands,
                red: [CARD_WITH_BONUS, CARD_PAY]
            }
        };

        const nextState = gameReducer(state, playCard({
            color: 'red',
            playCardId: CARD_WITH_BONUS.id,
            payCardId: CARD_PAY.id,
            row: 2,
            col: 2,
            settings: MOCK_SETTINGS
        }));

        // Expect card placed
        expect(nextState.grid[2][2]).toBeTruthy();
        // Expect pending bonuses
        expect(nextState.pendingBonuses.length).toBeGreaterThan(0);
        expect(nextState.pendingBonuses[0].definition.type).toBe('ADD_CUBE');
        // Expect turn STILL red
        expect(nextState.currentTurn).toBe('red');
    });

    it('should end turn if NO bonus triggered', () => {
        const baseState = getBaseState();
        const state = {
            ...baseState,
            hands: {
                ...baseState.hands,
                red: [CARD_NO_BONUS, CARD_PAY]
            }
        };

        const nextState = gameReducer(state, playCard({
            color: 'red',
            playCardId: CARD_NO_BONUS.id,
            payCardId: CARD_PAY.id,
            row: 2,
            col: 2,
            settings: MOCK_SETTINGS
        }));

        expect(nextState.pendingBonuses.length).toBe(0);
        expect(nextState.currentTurn).toBe('yellow');
    });

    it('should execute ADD_CUBE bonus and cascade if hitting another bonus', () => {
        const baseState = getBaseState();
        // Manual deepish clone/setup for grid
        const grid = baseState.grid.map(row => [...row]);

        const TARGET_CARD: Card = {
            ...CARD_WITH_BONUS,
            id: 'target1',
            cubes: 0,
            owner: 'red',
            bonuses: { 1: { type: 'REMOVE_CUBE' } } // Slot 1 has bonus
        };

        grid[2][2] = { ...CARD_WITH_BONUS, id: 'source', cubes: 1, owner: 'red' };
        grid[2][3] = TARGET_CARD;

        const bonus: BonusInstance = {
            id: 'b1',
            definition: { type: 'ADD_CUBE' },
            sourceCardId: 'source',
            sourceRow: 2,
            sourceCol: 2
        };

        const state = {
            ...baseState,
            grid,
            pendingBonuses: [bonus]
        };

        const nextState = gameReducer(state, resolveBonus({ bonusId: 'b1' }));

        // Expect Target Card (2,3) to have cube added
        expect(nextState.grid[2][3]?.cubes).toBe(1);

        // Expect New Bonus (Cascade) from (2,3)
        expect(nextState.pendingBonuses.length).toBe(1); // Old one removed, new one added
        expect(nextState.pendingBonuses[0].definition.type).toBe('REMOVE_CUBE');
        expect(nextState.pendingBonuses[0].sourceCardId).toBe('target1');
    });

    it('should execute REMOVE_CUBE on opponents', () => {
        const baseState = getBaseState();
        const grid = baseState.grid.map(row => [...row]);

        grid[2][2] = { ...CARD_NO_BONUS, id: 'source', owner: 'red' };
        grid[3][2] = { ...CARD_NO_BONUS, id: 'opp', owner: 'yellow', cubes: 2 };

        const bonus: BonusInstance = {
            id: 'b1',
            definition: { type: 'REMOVE_CUBE' },
            sourceCardId: 'source',
            sourceRow: 2,
            sourceCol: 2
        };

        const state = {
            ...baseState,
            grid,
            pendingBonuses: [bonus]
        };

        const nextState = gameReducer(state, resolveBonus({ bonusId: 'b1' }));

        // Expect opponent cubes reduced
        expect(nextState.grid[3][2]?.cubes).toBe(1);
    });
});

describe('Ownership Evaluation', () => {
    // Helper to get a clean state (Immutable)
    const getBaseState = () => {
        let state = gameReducer(undefined, { type: 'unknown' });
        state = gameReducer(state, addPlayer(RED_PLAYER));
        state = gameReducer(state, addPlayer(YELLOW_PLAYER));
        state = gameReducer(state, startGame({ rows: 5, cols: 5, seed: 'test' }));
        return state;
    };

    it('should update row ownership to RED if RED has majority', () => {
        const baseState = getBaseState();
        // Setup: Row 0 has Red Majority
        const grid = baseState.grid.map(row => [...row]);
        // 2 Red Cubes vs 0 Yellow
        grid[0][0] = { ...CARD_NO_BONUS, id: 'r1', owner: 'red', cubes: 2 };

        const state = {
            ...baseState,
            grid,
            // Ensure Row 0 starts as Yellow for the test to prove it flips
            rowHeaders: baseState.rowHeaders.map((h, i) => i === 0 ? { ...h, owner: 'yellow' as PlayerColor } : h),
            hands: { ...baseState.hands, red: [CARD_NO_BONUS, CARD_PAY] },
            currentTurn: 'red' as PlayerColor
        };

        // Play a card to trigger end of turn
        // We'll play into Row 1 to avoid messing up our setup in Row 0, but trigger evaluation
        const nextState = gameReducer(state, playCard({
            color: 'red',
            playCardId: CARD_NO_BONUS.id,
            payCardId: CARD_PAY.id,
            row: 1,
            col: 0,
            settings: MOCK_SETTINGS
        }));

        // Expect Row 0 owner to flip to Red
        expect(nextState.rowHeaders[0].owner).toBe('red');
    });

    it('should update row ownership to YELLOW if YELLOW has majority', () => {
        const baseState = getBaseState();
        const grid = baseState.grid.map(row => [...row]);
        // 2 Yellow Cubes vs 0 Red
        grid[0][0] = { ...CARD_NO_BONUS, id: 'y1', owner: 'yellow', cubes: 2 };

        const state = {
            ...baseState,
            grid,
            // Start as Red
            rowHeaders: baseState.rowHeaders.map((h, i) => i === 0 ? { ...h, owner: 'red' as PlayerColor } : h),
            hands: { ...baseState.hands, red: [CARD_NO_BONUS, CARD_PAY] },
            currentTurn: 'red' as PlayerColor
        };

        const nextState = gameReducer(state, playCard({
            color: 'red',
            playCardId: CARD_NO_BONUS.id,
            payCardId: CARD_PAY.id,
            row: 1,
            col: 0,
            settings: MOCK_SETTINGS
        }));

        expect(nextState.rowHeaders[0].owner).toBe('yellow');
    });

    it('should NOT update ownership on TIE', () => {
        const baseState = getBaseState();
        const grid = baseState.grid.map(row => [...row]);
        // 2 Red, 2 Yellow
        grid[0][0] = { ...CARD_NO_BONUS, id: 'r1', owner: 'red', cubes: 2 };
        grid[0][1] = { ...CARD_NO_BONUS, id: 'y1', owner: 'yellow', cubes: 2 };

        const state = {
            ...baseState,
            grid,
            // Start as Yellow
            rowHeaders: baseState.rowHeaders.map((h, i) => i === 0 ? { ...h, owner: 'yellow' as PlayerColor } : h),
            hands: { ...baseState.hands, red: [CARD_NO_BONUS, CARD_PAY] },
            currentTurn: 'red' as PlayerColor
        };

        const nextState = gameReducer(state, playCard({
            color: 'red',
            playCardId: CARD_NO_BONUS.id,
            payCardId: CARD_PAY.id,
            row: 1,
            col: 0,
            settings: MOCK_SETTINGS
        }));

        // Should REMAIN Yellow (Tie doesn't flip)
        expect(nextState.rowHeaders[0].owner).toBe('yellow');
    });

    it('should update COLUMN ownership correctly', () => {
        const baseState = getBaseState();
        const grid = baseState.grid.map(row => [...row]);
        // Col 2 has Red Majority
        grid[0][2] = { ...CARD_NO_BONUS, id: 'r1', owner: 'red', cubes: 3 };

        const state = {
            ...baseState,
            grid,
            colHeaders: baseState.colHeaders.map((h, i) => i === 2 ? { ...h, owner: 'yellow' as PlayerColor } : h),
            hands: { ...baseState.hands, red: [CARD_NO_BONUS, CARD_PAY] },
            currentTurn: 'red' as PlayerColor
        };

        const nextState = gameReducer(state, playCard({
            color: 'red',
            playCardId: CARD_NO_BONUS.id,
            payCardId: CARD_PAY.id,
            row: 1,
            col: 0,
            settings: MOCK_SETTINGS
        }));

        expect(nextState.colHeaders[2].owner).toBe('red');
    });
});
