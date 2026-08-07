import { describe, expect, it } from 'vitest';
import type { ControllerEvent } from './action-repository';
import { orderEventStream } from './action-repository';

const event = (
    id: string,
    clientSeq: number,
    createdAtMillis: number,
): ControllerEvent => ({
    id,
    type: 'player/registered',
    actorUid: 'player-a',
    payload: { color: 'red' },
    clientSeq,
    createdAtMillis,
});

describe('controller event ordering', () => {
    it('places pending events after acknowledged history despite a slow client clock', () => {
        const registered = event('remote', 1, 2_000);
        const selection = event('pending', 2, 1);

        expect(orderEventStream([registered], [selection]).map(({ id }) => id)).toEqual([
            registered.id,
            selection.id,
        ]);
    });

    it('orders pending events by client sequence and removes acknowledged duplicates', () => {
        const first = event('first', 1, 1);
        const second = event('second', 2, 2);

        expect(orderEventStream([first], [second, first]).map(({ id }) => id)).toEqual([
            first.id,
            second.id,
        ]);
    });
});
