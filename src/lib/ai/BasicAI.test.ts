import { describe, expect, it } from 'vitest';
import type { Card, GameState, PlayerColor } from '../types';
import { BasicAI } from './BasicAI';

function card(id: string): Card {
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
    };
}

function gameState(currentTurn: PlayerColor = 'red'): GameState {
    return {
        seed: 'test',
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
