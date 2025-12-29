import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import seedrandom from 'seedrandom';

export type PlayerColor = 'red' | 'yellow';
export type Edge = 'bottom' | 'top' | 'left' | 'right';


export interface Player {
    color: PlayerColor;
    edge: Edge;
}

// Re-export CardData as Card for consistency, or extend it
import type { CardData } from './cardLoader';
import type { GameSettings } from './settingsStore';
export type Card = CardData & { id: string; cubes?: number; owner?: PlayerColor; };

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
    grid: (Card | null)[][];
    rowHeaders: PopulationCard[];
    colHeaders: PopulationCard[];
    deck: Card[];
    offer: Card[];
    discard: Card[];
    hands: Record<PlayerColor, Card[]>;
    currentTurn: PlayerColor;
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
    currentTurn: 'red', // Default
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
        startGame: (state, action: PayloadAction<{ rows: number, cols: number, deck?: Card[], headers?: Card[], seed?: string }>) => {
            if (state.players.length === 2) {
                state.phase = 'playing';

                // Initialize RNG
                const rng = seedrandom(action.payload.seed);

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
                        const n = Math.floor(rng() * 3) + 1; // 1, 2, or 3
                        availableHeaders.push({ card: `start_${n}.svg`, count: n });
                    }
                }

                // Shuffle Headers
                for (let i = availableHeaders.length - 1; i > 0; i--) {
                    const j = Math.floor(rng() * (i + 1));
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
                    const j = Math.floor(rng() * (i + 1));
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
        playCard: (state, action: PayloadAction<{ color: PlayerColor, playCardId: string, payCardId: string, row: number, col: number, settings: GameSettings }>) => {
            const { color, playCardId, payCardId, row, col, settings } = action.payload;
            const hand = state.hands[color];

            // Validate cards exist in hand
            const playCard = hand.find(c => c.id === playCardId);
            const payCard = hand.find(c => c.id === payCardId);

            if (playCard && payCard) {
                // Validate Rules
                if (payCard.cost < playCard.cost) {
                    console.warn(`Invalid Play: Pay Cost ${payCard.cost} < Play Cost ${playCard.cost}`);
                    // return; // In Redux Toolkit, ensuring state validity is key. 
                    // To handle error feedback, we might need a status field, but for now we block the action effect.
                    // Actually, if we return, nothing happens. The UI shouldn't allow this dispatch ideally.
                    // But good to enforce here.
                    return;
                }

                // Calculate Cubes
                // Rule: CUBES_PER_PLAY + (ColorMatch ? CUBES_PER_COLOR_MATCH : 0) + (Overpay * CUBES_PER_OVERPAYMENT)
                const colorMatch = payCard.color === playCard.color ? settings.CUBES_PER_COLOR_MATCH : 0;
                const overpay = Math.max(0, payCard.cost - playCard.cost);
                const overpayBonus = overpay * settings.CUBES_PER_OVERPAYMENT;
                const cubes = settings.CUBES_PER_PLAY + colorMatch + overpayBonus;

                // Remove both from hand
                state.hands[color] = hand.filter(c => c.id !== playCardId && c.id !== payCardId);

                // Add pay card to discard
                state.discard.push(payCard);

                // Place play card on grid (Store Full Object + State)
                state.grid[row][col] = {
                    ...playCard,
                    cubes, // How many cubes to place
                    owner: color
                };

                // Toggle Turn
                state.currentTurn = state.currentTurn === 'red' ? 'yellow' : 'red';
            }
        },
        resetGame: (state) => {
            return initialState;
        }
    },
});

export const { addPlayer, removePlayer, startGame, dealCards, playerDiscard, playCard, resetGame } = gameSlice.actions;
export default gameSlice.reducer;
