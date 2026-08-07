import {
    assertFails,
    assertSucceeds,
    initializeTestEnvironment,
    type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { afterAll, afterEach, beforeAll, describe, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Firestore controller-event rules', () => {
    let environment: RulesTestEnvironment;

    beforeAll(async () => {
        environment = await initializeTestEnvironment({
            projectId: 'outpost7-e2e',
            firestore: { rules: await readFile('firestore.rules', 'utf8') },
        });
    });

    afterEach(() => environment.clearFirestore());
    afterAll(() => environment.cleanup());

    it('requires authentication to read or create events', async () => {
        const anonymous = environment.unauthenticatedContext().firestore();
        const authenticated = environment.authenticatedContext('player-a').firestore();

        await assertFails(getDoc(doc(anonymous, 'games/room/events/event')));
        await assertFails(setDoc(doc(anonymous, 'games/room/events/event'), event('player-a')));
        await assertSucceeds(setDoc(doc(authenticated, 'games/room/events/event'), event('player-a')));
    });

    it('only permits append-only events attributed to the signed-in user', async () => {
        const db = environment.authenticatedContext('player-a').firestore();
        const reference = doc(db, 'games/room/events/player-a-000001');

        await assertFails(setDoc(reference, event('player-b')));
        await assertSucceeds(setDoc(reference, event('player-a')));
        await assertFails(updateDoc(reference, { clientSeq: 2 }));
        await assertFails(deleteDoc(reference));
    });
});

function event(actorUid: string) {
    return {
        type: 'player/registered',
        payload: { color: 'red' },
        actorUid,
        clientSeq: 1,
        createdAt: new Date(),
    };
}
