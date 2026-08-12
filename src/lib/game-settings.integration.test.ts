import { describe, expect, it } from 'vitest';
import reducer, {
    addPlayer,
    playerDiscard,
    playCard,
    salvage,
    startGame,
    type Card,
    type GameState,
} from './gameSlice';
import { hasValidMoves } from './gameUtils';
import {
    DEFAULT_GAME_SETTINGS,
    GAME_SETTING_DEFINITIONS,
    type GameSettings,
} from './settingsStore';

function card(id: string, cost: number, color = 'blue'): Card {
    return {
        id,
        index: id,
        background: `${color}_module_${cost}.svg`,
        module_resource_1: `${color}_resource.svg`,
        text_module_resource_1: String(cost),
        cube_1: 'empty.svg',
        cube_2: 'empty.svg',
        cube_3: 'empty.svg',
        cube_4: 'empty.svg',
        cube_5: 'empty.svg',
        cube_6: 'empty.svg',
        maxCubes: 6,
        cost,
        color,
        bonuses: {},
    };
}

function settings(overrides: Partial<GameSettings> = {}): GameSettings {
    return { ...DEFAULT_GAME_SETTINGS, ...overrides };
}

function startedGame(rules: GameSettings, deck = Array.from({ length: 40 }, (_, index) =>
    card(`card-${index}`, index % 6 + 1),
)): GameState {
    let state = reducer(undefined, { type: 'unknown' });
    state = reducer(state, addPlayer({ color: 'red', edge: 'bottom' }));
    state = reducer(state, addPlayer({ color: 'yellow', edge: 'top' }));
    return reducer(state, startGame({ deck, headers: [], seed: 'settings-contract', settings: rules }));
}

describe('authoritative game settings', () => {
    it('defines a control for every configurable game constant', () => {
        expect(Object.keys(GAME_SETTING_DEFINITIONS)).toEqual(Object.keys(DEFAULT_GAME_SETTINGS));
        expect(DEFAULT_GAME_SETTINGS).toMatchObject({
            SALVAGE_MAX_COST: 12,
            CUBES_PER_COLOR_MATCH: 1,
            CUBES_PER_PLAY: 0,
            CUBES_PER_OVERPAYMENT: 1,
            GRID_ROWS: 5,
            GRID_COLS: 5,
            MAX_HAND_SIZE: 7,
            STARTING_HAND_SIZE: 5,
            BURN_CARD_COUNT: 10,
            OFFER_SIZE: 5,
            OPENING_HAND_VALUE_LIMIT_P1: 12,
            OPENING_HAND_VALUE_LIMIT_P2: 16,
            ALLOW_ZERO_CUBE_REPAIRS: false,
            RANDOMIZE_BORDER_COLORS: false,
        });
    });

    it('uses the game settings snapshot for every deck-setup count', () => {
        const rules = settings({
            GRID_ROWS: 3,
            GRID_COLS: 4,
            BURN_CARD_COUNT: 2,
            OFFER_SIZE: 3,
            STARTING_HAND_SIZE: 7,
        });
        const state = startedGame(rules);

        expect(state.settings).toEqual(rules);
        expect(state.grid).toHaveLength(3);
        expect(state.grid.every(row => row.length === 4)).toBe(true);
        expect(state.discard).toHaveLength(2);
        expect(state.offer).toHaveLength(3);
        expect(state.hands.red).toHaveLength(7);
        expect(state.hands.yellow).toHaveLength(7);
        expect(state.deck).toHaveLength(21);
    });

    it('assigns seeded random resource colours to border cards only when enabled', () => {
        const enabledRules = settings({
            GRID_ROWS: 3,
            GRID_COLS: 4,
            RANDOMIZE_BORDER_COLORS: true,
        });
        const first = startedGame(enabledRules);
        const replay = startedGame(enabledRules);
        const colours = [...first.colHeaders, ...first.rowHeaders].map(({ color }) => color);

        expect(colours).toHaveLength(7);
        expect(colours.every((color) => ['blue', 'green', 'purple'].includes(color ?? ''))).toBe(true);
        expect([...replay.colHeaders, ...replay.rowHeaders].map(({ color }) => color)).toEqual(colours);

        const disabled = startedGame(settings({ GRID_ROWS: 3, GRID_COLS: 4 }));
        expect([...disabled.colHeaders, ...disabled.rowHeaders].every(({ color }) => color === undefined))
            .toBe(true);
    });

    it('enforces custom salvage cost and hand-size limits in valid moves and the reducer', () => {
        const rules = settings({ SALVAGE_MAX_COST: 3, MAX_HAND_SIZE: 2 });
        const expensive = card('expensive', 4);
        const affordable = card('affordable', 3);
        let state = startedGame(rules);
        state = {
            ...state,
            grid: [[null]],
            rowHeaders: [],
            colHeaders: [],
            offer: [expensive],
            hands: { red: [], yellow: [] },
            currentTurn: 'red',
        };

        expect(hasValidMoves(state, 'red')).toBe(false);
        expect(reducer(state, salvage({ color: 'red', cardIds: [expensive.id] }))).toEqual(state);

        state = { ...state, offer: [affordable] };
        expect(hasValidMoves(state, 'red')).toBe(true);
        state = reducer(state, salvage({ color: 'red', cardIds: [affordable.id] }));
        expect(state.hands.red.map(({ id }) => id)).toEqual([affordable.id]);

        const fullHandState = {
            ...state,
            currentTurn: 'red' as const,
            grid: [[card('occupied', 1)]],
            offer: [card('another', 1)],
            hands: { ...state.hands, red: [card('one', 1), card('two', 1)] },
        };
        expect(hasValidMoves(fullHandState, 'red')).toBe(false);
        expect(reducer(
            fullHandState,
            salvage({ color: 'red', cardIds: ['another'] }),
        )).toEqual(fullHandState);
    });

    it('rejects zero-cube repairs by default and makes allowed zero-cube cards neutral', () => {
        const play = card('play', 3, 'blue');
        const pay = card('pay', 3, 'green');
        let state = startedGame(settings({
            CUBES_PER_PLAY: 0,
            CUBES_PER_COLOR_MATCH: 1,
            CUBES_PER_OVERPAYMENT: 1,
            ALLOW_ZERO_CUBE_REPAIRS: false,
        }));
        state = {
            ...state,
            grid: [[null]],
            rowHeaders: [],
            colHeaders: [],
            offer: [],
            hands: { red: [play, pay], yellow: [] },
            currentTurn: 'red',
        };

        const action = playCard({
            color: 'red',
            playCardId: play.id,
            payCardId: pay.id,
            row: 0,
            col: 0,
        });
        expect(hasValidMoves(state, 'red')).toBe(false);
        expect(reducer(state, action)).toEqual(state);

        const allowedState = {
            ...state,
            settings: { ...state.settings, ALLOW_ZERO_CUBE_REPAIRS: true },
        };
        expect(hasValidMoves(allowedState, 'red')).toBe(true);
        const next = reducer(allowedState, action);
        expect(next.grid[0][0]).toMatchObject({ id: play.id, cubes: 0 });
        expect(next.grid[0][0]?.owner).toBeUndefined();
    });

    it('enforces configured opening-value and hand-size limits when accepting a discard', () => {
        const low = card('low', 1);
        const medium = card('medium', 2);
        const high = card('high', 3);
        const rules = settings({
            MAX_HAND_SIZE: 2,
            OPENING_HAND_VALUE_LIMIT_P1: 3,
        });
        const state = {
            ...startedGame(rules),
            hands: { red: [low, medium, high], yellow: [] },
            currentTurn: 'red' as const,
            turnCount: 1,
        };

        expect(reducer(state, playerDiscard({ color: 'red', cardIds: [low.id] }))).toEqual(state);

        const accepted = reducer(state, playerDiscard({ color: 'red', cardIds: [high.id] }));
        expect(accepted.hands.red.map(({ id }) => id)).toEqual([low.id, medium.id]);
        expect(accepted.discard.at(-1)?.id).toBe(high.id);
    });
});
