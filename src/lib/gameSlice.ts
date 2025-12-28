import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type PlayerColor = 'red' | 'yellow';
export type Edge = 'bottom' | 'top' | 'left' | 'right';

export interface Player {
    color: PlayerColor;
    edge: Edge;
}

export interface Cell {
    card: string;
    owner: PlayerColor;
}

export type GamePhase = 'lobby' | 'playing';

interface GameState {
    players: Player[];
    phase: GamePhase;
    orientation: number;
    grid: Cell[][];
}

const initialState: GameState = {
    players: [],
    phase: 'lobby',
    orientation: 0,
    grid: [],
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

                // Initialize Grid
                const { rows, cols } = action.payload;
                const newGrid: Cell[][] = [];

                // Sort players to ensure consistent ownership assignment (e.g. by edge order or just insertion order)
                // Using insertion order as simple "Player 1 vs Player 2"
                const p1 = state.players[0];
                const p2 = state.players[1];

                for (let r = 0; r < rows; r++) {
                    const row: Cell[] = [];
                    for (let c = 0; c < cols; c++) {
                        // Random start card (1-3)
                        const cardNum = Math.floor(Math.random() * 3) + 1;

                        // Alternating ownership by row
                        // Row 0, 2, 4... = Player 1
                        // Row 1, 3, 5... = Player 2
                        const owner = (r % 2 === 0) ? p1.color : p2.color;

                        row.push({
                            card: `start_${cardNum}.svg`,
                            owner
                        });
                    }
                    newGrid.push(row);
                }
                state.grid = newGrid;
            }
        },
        resetGame: (state) => {
            return initialState;
        }
    },
});

export const { addPlayer, removePlayer, startGame, resetGame } = gameSlice.actions;
export default gameSlice.reducer;
