import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type PlayerColor = 'red' | 'yellow';
export type Edge = 'bottom' | 'top' | 'left' | 'right';

export interface Player {
    color: PlayerColor;
    edge: Edge;
}

export type GamePhase = 'lobby' | 'playing';

interface GameState {
    players: Player[];
    phase: GamePhase;
    orientation: number;
}

const initialState: GameState = {
    players: [],
    phase: 'lobby',
    orientation: 0,
};

const gameSlice = createSlice({
    name: 'game',
    initialState,
    reducers: {
        addPlayer: (state, action: PayloadAction<Player>) => {
            // Prevent adding if edge is occupied or color is taken (though logic might allow duplicate colors if rule didn't say otherwise, but strictly 2 players red/yellow usually means unique)
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
        startGame: (state) => {
            if (state.players.length === 2) {
                state.phase = 'playing';
                // Calculate orientation based on players. 
                // Default (0) is suitable if a player is at bottom.
                // If players are Top/Bottom -> 0 or 180 is fine.
                // If players are Left/Right -> 90 or 270.
                // Simple logic: orient so first player added is at "bottom" conceptually? 
                // Or just fixed 0 for MVP as requested "set up the grid oriented logically".
                // Let's implement a simple heuristic: 
                // If Bottom occupied -> 0.
                // Else if Right occupied -> 270 (so Right becomes Bottom).
                // Else if Top occupied -> 180 (so Top becomes Bottom).
                // Else (Left occupied) -> 90 (so Left becomes Bottom).
                const hasBottom = state.players.some(p => p.edge === 'bottom');
                const hasRight = state.players.some(p => p.edge === 'right');
                const hasTop = state.players.some(p => p.edge === 'top');
                const hasLeft = state.players.some(p => p.edge === 'left');

                if (hasBottom) state.orientation = 0;
                else if (hasRight) state.orientation = 270;
                else if (hasTop) state.orientation = 180;
                else if (hasLeft) state.orientation = 90;
            }
        },
        resetGame: (state) => {
            return initialState;
        }
    },
});

export const { addPlayer, removePlayer, startGame, resetGame } = gameSlice.actions;
export default gameSlice.reducer;
