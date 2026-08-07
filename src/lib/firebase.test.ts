import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = { currentUser: { uid: 'anonymous-user' } };
const db = {};
const inMemoryPersistence = { type: 'NONE' };
const setPersistence = vi.fn(async () => undefined);
const signInAnonymously = vi.fn(async () => undefined);

vi.mock('firebase/app', () => ({
    initializeApp: vi.fn(() => ({})),
}));

vi.mock('firebase/auth', () => ({
    connectAuthEmulator: vi.fn(),
    getAuth: vi.fn(() => auth),
    inMemoryPersistence,
    setPersistence,
    signInAnonymously,
}));

vi.mock('firebase/firestore', () => ({
    connectFirestoreEmulator: vi.fn(),
    getFirestore: vi.fn(() => db),
}));

vi.mock('./firebase-config', () => ({
    readFirebaseConfig: vi.fn(() => ({
        apiKey: 'api-key',
        authDomain: 'project.firebaseapp.com',
        projectId: 'project',
        storageBucket: 'project.firebasestorage.app',
        messagingSenderId: '123',
        appId: 'app-id',
    })),
}));

describe('Firebase authentication', () => {
    beforeEach(() => {
        setPersistence.mockClear();
        signInAnonymously.mockClear();
    });

    it('isolates anonymous identities per browser tab before signing in', async () => {
        const { initializeFirebase } = await import('./firebase');

        await initializeFirebase();

        expect(setPersistence).toHaveBeenCalledWith(auth, inMemoryPersistence);
        expect(setPersistence.mock.invocationCallOrder[0]).toBeLessThan(
            signInAnonymously.mock.invocationCallOrder[0],
        );
    });
});
