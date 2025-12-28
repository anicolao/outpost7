import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type PlayerColor = 'red' | 'yellow';
export type Edge = 'bottom' | 'top' | 'left' | 'right';

export interface Player {
    color: PlayerColor;
    edge: Edge;
}

export interface PopulationCard {
    card: string;
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
}

const initialState: GameState = {
    players: [],
    phase: 'lobby',
    orientation: 0,
    grid: [],
    rowHeaders: [],
    colHeaders: [],
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
        startGame: (state, action: PayloadAction<{ rows: number, cols: number }>) => {
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
                const deck: { card: string, count: number }[] = [];
                for (let i = 0; i < 15; i++) {
                    const n = Math.floor(Math.random() * 3) + 1; // 1, 2, or 3
                    deck.push({ card: `start_${n}.svg`, count: n });
                }

                // Shuffle (simple Fisher-Yates)
                for (let i = deck.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [deck[i], deck[j]] = [deck[j], deck[i]];
                }

                // Draw 10
                const drawn = deck.slice(0, 10);

                // Assign Owners
                const headersWithOwners: PopulationCard[] = drawn.map((d, i) => ({
                    ...d,
                    owner: (i % 2 === 0) ? 'red' : 'yellow'
                }));

                // Split into Cols (Top) and Rows (Left)
                state.colHeaders = headersWithOwners.slice(0, 5);
                state.rowHeaders = headersWithOwners.slice(5, 10);
            }
        },
        resetGame: (state) => {
            return initialState;
        }
    },
});

export const { addPlayer, removePlayer, startGame, resetGame } = gameSlice.actions;
export default gameSlice.reducer;
