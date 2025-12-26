import { readable } from 'svelte/store';
import { store, type RootState } from './store';

export const gameState = readable<RootState>(store.getState(), (set) => {
    const unsubscribe = store.subscribe(() => {
        set(store.getState());
    });
    return unsubscribe;
});
