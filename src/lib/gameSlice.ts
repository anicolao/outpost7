import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type PlayerColor = 'red' | 'yellow';
export type Edge = 'bottom' | 'top' | 'left' | 'right';


export interface Player {
    color: PlayerColor;
    edge: Edge;
}

// Re-export CardData as Card for consistency, or extend it
import type { CardData } from './cardLoader';
export type Card = CardData & { id: string };

export interface PopulationCard {
    card: string; // filename
    count: number;
    owner: PlayerColor;
}

export type GamePhase = 'lobby' | 'playing';

interface GameState {
    players: Player[];
    phase: GamePhase;
    orientation: number;
    grid: (string | null)[][];
    rowHeaders: PopulationCard[];
    colHeaders: PopulationCard[];
    deck: Card[];
    offer: Card[];
    discard: Card[];
    hands: Record<PlayerColor, Card[]>;
}

const initialState: GameState = {
    players: [],
    phase: 'lobby',
    orientation: 0,
    grid: [],
    rowHeaders: [],
    colHeaders: [],
    deck: [],
    offer: [],
    discard: [],
    hands: { red: [], yellow: [] },
};

const gameSlice = createSlice({
    name: 'game',
    initialState,
    reducers: {
        addPlayer: (state, action: PayloadAction<Player>) => {
            const { color, edge } = action.payload;
            const edgeOccupied = state.players.some(p => p.edge === edge);
            const colorTaken = state.players.some(p => p.color === color);

            if (!edgeOccupied && !colorTaken) {
                state.players.push(action.payload);
            }
        },
        removePlayer: (state, action: PayloadAction<Edge>) => {
            state.players = state.players.filter(p => p.edge !== action.payload);
        },
        startGame: (state, action: PayloadAction<{ rows: number, cols: number, deck?: Card[], headers?: Card[] }>) => {
            if (state.players.length === 2) {
                state.phase = 'playing';

                // Orientation logic
                const hasBottom = state.players.some(p => p.edge === 'bottom');
                const hasRight = state.players.some(p => p.edge === 'right');
                const hasTop = state.players.some(p => p.edge === 'top');
                const hasLeft = state.players.some(p => p.edge === 'left');

                if (hasBottom) state.orientation = 0;
                else if (hasRight) state.orientation = 270;
                else if (hasTop) state.orientation = 180;
                else if (hasLeft) state.orientation = 90;

                // Initialize Grid (Empty)
                const { rows, cols } = action.payload;
                state.grid = Array(rows).fill(null).map(() => Array(cols).fill(null));

                // Initialize Headers
                const availableHeaders: { card: string, count: number }[] = [];

                if (action.payload.headers && action.payload.headers.length > 0) {
                    // Use provided headers
                    // Extract count from filename "start_N.pdf" -> N
                    availableHeaders.push(...action.payload.headers.map(h => {
                        const match = h.background.match(/start_(\d+)/);
                        const count = match ? parseInt(match[1], 10) : 1;
                        return { card: h.background, count };
                    }));
                } else {
                    // Fallback Dummy Headers
                    for (let i = 0; i < 15; i++) {
                        const n = Math.floor(Math.random() * 3) + 1; // 1, 2, or 3
                        availableHeaders.push({ card: `start_${n}.svg`, count: n });
                    }
                }

                // Shuffle Headers
                for (let i = availableHeaders.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [availableHeaders[i], availableHeaders[j]] = [availableHeaders[j], availableHeaders[i]];
                }

                // Draw 10
                const drawnHeaders = availableHeaders.slice(0, 10);

                // Assign Owners
                const headersWithOwners: PopulationCard[] = drawnHeaders.map((d, i) => ({
                    ...d,
                    owner: (i % 2 === 0) ? 'red' : 'yellow'
                }));

                // Split into Cols (Top) and Rows (Left)
                state.colHeaders = headersWithOwners.slice(0, 5);
                state.rowHeaders = headersWithOwners.slice(5, 10);

                // --- Card Deck Initialization ---
                // Use provided deck or fallback (though fallback will be empty/invalid with new type)
                // We assume action.payload.deck is provided and shuffled, or we shuffle here.
                let deckCards: Card[] = action.payload.deck ? [...action.payload.deck] : [];

                // Shuffle Deck if passed in, or if we want to ensure randomness here
                for (let i = deckCards.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [deckCards[i], deckCards[j]] = [deckCards[j], deckCards[i]];
                }

                // Burn 10
                state.discard = deckCards.slice(0, 10);
                let currentDeck = deckCards.slice(10);

                // Deal Offer (5 cards)
                state.offer = currentDeck.slice(0, 5);
                currentDeck = currentDeck.slice(5);

                // Deal Hands (5 cards each)
                state.hands.red = currentDeck.slice(0, 5);
                state.hands.yellow = currentDeck.slice(5, 10);
                state.deck = currentDeck.slice(10);
            }
        },
        dealCards: (state, action: PayloadAction<{ count: number, to: PlayerColor }>) => {
            const { count, to } = action.payload;
            const drawn = state.deck.slice(0, count);
            state.deck = state.deck.slice(count);
            state.hands[to].push(...drawn);
        },
        playerDiscard: (state, action: PayloadAction<{ color: PlayerColor, cardIds: string[] }>) => {
            const { color, cardIds } = action.payload;
            const hand = state.hands[color];
            const toDiscard = hand.filter(c => cardIds.includes(c.id));
            const newHand = hand.filter(c => !cardIds.includes(c.id));

            state.hands[color] = newHand;
            state.discard.push(...toDiscard);
        },
        resetGame: (state) => {
            return initialState;
        }
    },
});

export const { addPlayer, removePlayer, startGame, dealCards, playerDiscard, resetGame } = gameSlice.actions;
export default gameSlice.reducer;
