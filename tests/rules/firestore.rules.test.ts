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

describe('Firestore card-set rules', () => {
    let environment: RulesTestEnvironment;

    beforeAll(async () => {
        environment = await initializeTestEnvironment({
            projectId: 'outpost7-e2e',
            firestore: { rules: await readFile('firestore.rules', 'utf8') },
        });
    });

    afterEach(() => environment.clearFirestore());
    afterAll(() => environment.cleanup());

    it('lets authenticated visitors create and read immutable shared card sets', async () => {
        const creator = environment.authenticatedContext('designer-a').firestore();
        const viewer = environment.authenticatedContext('designer-b').firestore();
        const reference = doc(creator, 'cardSets/set-v49');

        await assertSucceeds(setDoc(reference, cardSet('designer-a')));
        await assertSucceeds(getDoc(doc(viewer, 'cardSets/set-v49')));
        await assertFails(updateDoc(reference, { name: 'changed' }));
        await assertFails(deleteDoc(reference));
    });

    it('rejects unauthenticated or malformed card-set uploads', async () => {
        const anonymous = environment.unauthenticatedContext().firestore();
        const authenticated = environment.authenticatedContext('designer-a').firestore();

        await assertFails(getDoc(doc(anonymous, 'cardSets/set-v49')));
        await assertFails(setDoc(doc(anonymous, 'cardSets/set-v49'), cardSet('designer-a')));
        await assertFails(
            setDoc(doc(authenticated, 'cardSets/set-wrong-owner'), cardSet('designer-b')),
        );
        await assertFails(
            setDoc(doc(authenticated, 'cardSets/set-empty'), {
                ...cardSet('designer-a'),
                source: '',
                cardCount: 0,
            }),
        );
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

function cardSet(createdBy: string) {
    return {
        name: 'v49',
        source: 'index\tbackground\n1\tblue_module_3.pdf',
        cardCount: 1,
        createdBy,
        createdAt: new Date(),
    };
}
