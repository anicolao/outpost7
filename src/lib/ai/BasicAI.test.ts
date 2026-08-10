import { describe, expect, it } from 'vitest';
import { DEFAULT_GAME_SETTINGS, type GameSettings } from '../settingsStore';
import type { Card, GameState, PlayerColor } from '../types';
import { BasicAI } from './BasicAI';

function card(id: string, overrides: Partial<Card> = {}): Card {
    return {
        id,
        index: id,
        background: 'module.svg',
        module_resource_1: 'red_module',
        text_module_resource_1: '1',
        cube_1: 'cube',
        cube_2: '',
        cube_3: '',
        cube_4: '',
        cube_5: '',
        cube_6: '',
        cost: 1,
        color: 'red',
        bonuses: {},
        maxCubes: 1,
        ...overrides,
    };
}

function settings(overrides: Partial<GameSettings> = {}): GameSettings {
    return {
        ...DEFAULT_GAME_SETTINGS,
        CUBES_PER_PLAY: 0,
        GRID_ROWS: 2,
        GRID_COLS: 2,
        ...overrides,
    };
}

function gameState(currentTurn: PlayerColor = 'red'): GameState {
    return {
        seed: 'test',
        settings: settings(),
        players: [
            { color: 'red', edge: 'bottom', type: 'ai' },
            { color: 'yellow', edge: 'top', type: 'ai' },
        ],
        phase: 'playing',
        orientation: 0,
        grid: [[null, null], [null, null]],
        rowHeaders: [],
        colHeaders: [],
        deck: [],
        offer: [],
        discard: [],
        hands: {
            red: [card('a'), card('b')],
            yellow: [card('c'), card('d')],
        },
        currentTurn,
        turnCount: 1,
        pendingBonuses: [],
        finishedPlayers: [],
        winner: null,
        scores: { red: 0, yellow: 0 },
        bonusIdCounter: 0,
    };
}

function repairSequence(seed: string, count = 12) {
    const ai = new BasicAI('red', seed);
    const state = gameState();

    return Array.from({ length: count }, () => ai.computeMove(state));
}

describe('BasicAI seeded tie-breaking', () => {
    it('replays the same move sequence for the same seed', () => {
        expect(repairSequence('replayable-game')).toEqual(repairSequence('replayable-game'));
    });

    it('produces different move sequences for different seeds', () => {
        expect(repairSequence('game-a')).not.toEqual(repairSequence('game-b'));
    });

    it('can select every equally scored repair instead of favoring iteration order', () => {
        const selectedMoves = new Set(
            Array.from({ length: 128 }, (_, index) => {
                const move = new BasicAI('red', `coverage-${index}`).computeMove(gameState());
                if (move.type !== 'REPAIR') throw new Error(`Expected REPAIR, received ${move.type}`);
                return `${move.playCardId}:${move.payCardId}:${move.row}:${move.col}`;
            }),
        );

        expect(selectedMoves).toEqual(new Set([
            'a:b:0:0',
            'a:b:0:1',
            'a:b:1:0',
            'a:b:1:1',
            'b:a:0:0',
            'b:a:0:1',
            'b:a:1:0',
            'b:a:1:1',
        ]));
    });

    it('never randomizes into a lower-scoring repair', () => {
        const state = gameState();
        state.hands.red[0].bonuses = { 1: { type: 'ADD_CUBE' } };

        for (let index = 0; index < 64; index++) {
            const move = new BasicAI('red', `best-only-${index}`).computeMove(state);
            if (move.type !== 'REPAIR') throw new Error(`Expected REPAIR, received ${move.type}`);
            expect(move.playCardId).toBe('a');
        }
    });
});

describe('BasicAI repair outcome scoring', () => {
    it('uses the configured cube rules when choosing a repair', () => {
        const state = gameState();
        state.hands.red = [
            card('module', {
                cost: 4,
                color: 'red',
                maxCubes: 3,
                bonuses: { 3: { type: 'ADD_CUBE' } },
            }),
            card('off-color-payment', { cost: 4, color: 'blue', maxCubes: 3 }),
            card('matching-payment', { cost: 4, color: 'red', maxCubes: 3 }),
        ];
        const ai = new BasicAI('red', 'configured-rules', settings({
            CUBES_PER_COLOR_MATCH: 0,
            CUBES_PER_PLAY: 3,
            CUBES_PER_OVERPAYMENT: 0,
        }));

        const move = ai.computeMove(state);

        expect(move).toMatchObject({
            type: 'REPAIR',
            playCardId: 'module',
        });
    });

    it('respects cube capacity and preserves an expensive payment when it adds no value', () => {
        const state = gameState();
        state.hands.red = [
            card('module', {
                cost: 1,
                color: 'red',
                maxCubes: 1,
                bonuses: { 1: { type: 'ADD_POPULATION', color: 'red' } },
            }),
            card('exact-payment', { cost: 1, color: 'blue' }),
            card('wasteful-payment', { cost: 6, color: 'blue' }),
        ];
        const ai = new BasicAI('red', 'payment-efficiency', settings({
            CUBES_PER_COLOR_MATCH: 0,
            CUBES_PER_PLAY: 1,
            CUBES_PER_OVERPAYMENT: 1,
        }));

        const move = ai.computeMove(state);

        expect(move).toMatchObject({
            type: 'REPAIR',
            playCardId: 'module',
            payCardId: 'exact-payment',
        });
    });
});

describe('BasicAI board strategy', () => {
    it('takes control of the highest-population line', () => {
        const state = gameState();
        state.grid = [
            [card('anchor', { owner: 'yellow', cubes: 1 }), null],
            [null, null],
        ];
        state.rowHeaders = [
            { card: 'high-value-row', count: 6, owner: 'yellow' },
            { card: 'low-value-row', count: 1, owner: 'yellow' },
        ];
        state.colHeaders = [
            { card: 'zero-value-column', count: 0, owner: 'yellow' },
            { card: 'zero-value-column', count: 0, owner: 'yellow' },
        ];
        state.hands.red = [
            card('module', {
                cost: 2,
                maxCubes: 2,
                bonuses: { 2: { type: 'ADD_POPULATION', color: 'blue' } },
            }),
            card('payment', { cost: 2, maxCubes: 2 }),
        ];
        state.hands.yellow = [];
        const ai = new BasicAI('red', 'valuable-line', settings({
            CUBES_PER_COLOR_MATCH: 0,
            CUBES_PER_PLAY: 2,
            CUBES_PER_OVERPAYMENT: 0,
        }));

        const move = ai.computeMove(state);

        expect(move).toMatchObject({
            type: 'REPAIR',
            playCardId: 'module',
            row: 0,
            col: 1,
        });
    });

    it('prefers control that survives the opponent strongest next placement', () => {
        const state = gameState();
        state.grid = [
            [null, card('anchor', { owner: 'yellow', cubes: 1 }), null],
            [null, null, null],
        ];
        state.rowHeaders = [
            { card: 'valuable-row', count: 5, owner: 'yellow' },
            { card: 'zero-value-row', count: 0, owner: 'yellow' },
        ];
        state.colHeaders = [
            { card: 'zero-value-column', count: 0, owner: 'yellow' },
            { card: 'valuable-column', count: 5, owner: 'yellow' },
            { card: 'zero-value-column', count: 0, owner: 'yellow' },
        ];
        state.hands.red = [
            card('module', {
                cost: 2,
                maxCubes: 2,
                bonuses: { 2: { type: 'ADD_POPULATION', color: 'blue' } },
            }),
            card('payment', { cost: 2, maxCubes: 2 }),
        ];
        state.hands.yellow = [
            card('opponent-module', { cost: 2, color: 'yellow', maxCubes: 2 }),
            card('opponent-payment', { cost: 2, color: 'yellow', maxCubes: 2 }),
        ];
        const ai = new BasicAI('red', 'defend-control', settings({
            CUBES_PER_COLOR_MATCH: 0,
            CUBES_PER_PLAY: 2,
            CUBES_PER_OVERPAYMENT: 0,
        }));

        const move = ai.computeMove(state);

        expect(move).toMatchObject({
            type: 'REPAIR',
            playCardId: 'module',
            row: 1,
            col: 1,
        });
    });

    it('chooses the least damaging legal repair instead of passing', () => {
        const state = gameState();
        state.grid = [[card('anchor', { owner: 'red', cubes: 1 }), null, null]];
        state.rowHeaders = [{ card: 'vulnerable-row', count: 10, owner: 'red' }];
        state.colHeaders = [
            { card: 'zero-value-column', count: 0, owner: 'red' },
            { card: 'zero-value-column', count: 0, owner: 'red' },
            { card: 'zero-value-column', count: 0, owner: 'red' },
        ];
        state.hands.red = [
            card('module', {
                cost: 2,
                maxCubes: 1,
                bonuses: { 1: { type: 'ADD_POPULATION', color: 'blue' } },
            }),
            card('payment', { cost: 2, maxCubes: 1 }),
        ];
        state.hands.yellow = [
            card('opponent-module', { cost: 2, color: 'yellow', maxCubes: 3 }),
            card('opponent-payment', { cost: 2, color: 'yellow', maxCubes: 3 }),
        ];
        const ai = new BasicAI('red', 'least-damaging', settings({
            CUBES_PER_COLOR_MATCH: 0,
            CUBES_PER_PLAY: 3,
            CUBES_PER_OVERPAYMENT: 0,
        }));

        expect(ai.computeMove(state)).toMatchObject({
            type: 'REPAIR',
            playCardId: 'module',
            row: 0,
            col: 1,
        });
    });
});

describe('BasicAI hand and offer planning', () => {
    it('salvages a matching card that creates a valuable repair instead of the cheapest card', () => {
        const state = gameState();
        state.hands.red = [card('foundation', {
            cost: 4,
            color: 'blue',
            maxCubes: 3,
        })];
        state.offer = [
            card('cheap-filler', { cost: 1, color: 'red', maxCubes: 1 }),
            card('matching-module', {
                cost: 4,
                color: 'blue',
                maxCubes: 3,
                bonuses: { 1: { type: 'ADD_POPULATION', color: 'blue' } },
            }),
        ];
        const ai = new BasicAI('red', 'future-repair', settings({
            SALVAGE_MAX_COST: 4,
            CUBES_PER_OVERPAYMENT: 0,
        }));

        expect(ai.computeMove(state)).toEqual({
            type: 'SALVAGE',
            cardIds: ['matching-module'],
        });
    });

    it('evaluates complete affordable subsets to assemble a play and payment pair', () => {
        const state = gameState();
        state.hands.red = [];
        state.offer = [
            card('cheap-filler', { cost: 1, color: 'red', maxCubes: 1 }),
            card('blue-module', {
                cost: 3,
                color: 'blue',
                maxCubes: 3,
                bonuses: { 1: { type: 'ADD_CUBE' } },
            }),
            card('blue-payment', { cost: 3, color: 'blue', maxCubes: 3 }),
            card('standalone-expensive', { cost: 6, color: 'yellow', maxCubes: 3 }),
        ];
        const ai = new BasicAI('red', 'offer-combination', settings({
            SALVAGE_MAX_COST: 6,
            CUBES_PER_OVERPAYMENT: 0,
        }));

        expect(ai.computeMove(state)).toEqual({
            type: 'SALVAGE',
            cardIds: ['blue-module', 'blue-payment'],
        });
    });

    it('uses seeded tie-breaking for equally valuable salvage plans', () => {
        const selections = Array.from({ length: 64 }, (_, index) => {
            const state = gameState();
            state.hands.red = [card('foundation', {
                cost: 2,
                color: 'blue',
                maxCubes: 2,
            })];
            state.offer = [
                card('option-a', { cost: 2, color: 'blue', maxCubes: 2 }),
                card('option-b', { cost: 2, color: 'blue', maxCubes: 2 }),
            ];

            return new BasicAI('red', `salvage-tie-${index}`, settings({
                SALVAGE_MAX_COST: 2,
                CUBES_PER_OVERPAYMENT: 0,
            })).computeMove(state);
        });

        expect(new Set(selections.map(move => JSON.stringify(move)))).toEqual(new Set([
            JSON.stringify({ type: 'SALVAGE', cardIds: ['option-a'] }),
            JSON.stringify({ type: 'SALVAGE', cardIds: ['option-b'] }),
        ]));

        const repeatedState = gameState();
        repeatedState.hands.red = [card('foundation', { cost: 2, color: 'blue', maxCubes: 2 })];
        repeatedState.offer = [
            card('option-a', { cost: 2, color: 'blue', maxCubes: 2 }),
            card('option-b', { cost: 2, color: 'blue', maxCubes: 2 }),
        ];
        const repeatedSettings = settings({ SALVAGE_MAX_COST: 2, CUBES_PER_OVERPAYMENT: 0 });

        expect(new BasicAI('red', 'repeat-salvage', repeatedSettings).computeMove(repeatedState))
            .toEqual(new BasicAI('red', 'repeat-salvage', repeatedSettings).computeMove(repeatedState));
    });
});
