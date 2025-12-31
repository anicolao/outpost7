import type { GameState, PlayerColor } from './types';

// Logic to check if a player has ANY valid moves
export function hasValidMoves(state: GameState, player: PlayerColor): boolean {
    const hand = state.hands[player];

    // 1. Check Salvage
    // Valid if hand is not full AND offer has at least one card <= 12
    if (hand.length < 7) {
        const canPickUpAny = state.offer.some(c => c.cost <= 12); // Rule: Total <= 12. Cheapest card implies possible move.
        // Actually, if offer is empty, can they salvage?
        // Rule: "Pickup any combination... from the 5 face up"
        // If deck empty and offer empty -> NO salvage.
        // If deck not empty but offer empty (shouldn't happen with refill logic unless deck empties) -> wait, refill happens immediately.
        // So checking offer is enough.
        if (canPickUpAny) return true;
        // Even if all cards > 12 (unlikely/impossible given card distribution, but theoretically), if you can pick 0 cards?
        // Rules say "Pick up any combination". Picking 0 is usually not a turn. "Pass" is the action when you can't play.
    }

    // 2. Check Repair
    // Need:
    // A play card
    // A pay card (same or higher value)
    // A valid spot on grid

    // Quick check: If no cards in hand, cannot repair.
    if (hand.length < 2) return false; // Need at least pair

    // Check if any pair in hand is valid (Pay >= Play)
    // Sort hand by cost? O(N log N) - hand is small (max 7)
    // Actually just double loop O(N^2) is fine.

    let hasValidPair = false;
    for (let i = 0; i < hand.length; i++) {
        for (let j = 0; j < hand.length; j++) {
            if (i === j) continue;
            if (hand[j].cost >= hand[i].cost) {
                hasValidPair = true;
                break;
            }
        }
        if (hasValidPair) break;
    }

    if (!hasValidPair) return false;

    // Check if valid spot on grid
    // Format: First card anywhere. Subsequent: Adjacent.
    let gridEmpty = true;
    let validSpots: [number, number][] = [];

    for (let r = 0; r < state.grid.length; r++) {
        for (let c = 0; c < state.grid[r].length; c++) {
            if (state.grid[r][c] !== null) {
                gridEmpty = false;
            }
        }
    }

    if (gridEmpty) return true; // Can place first card anywhere

    // Find empty spots adjacent to existing cards
    for (let r = 0; r < state.grid.length; r++) {
        for (let c = 0; c < state.grid[r].length; c++) {
            if (state.grid[r][c] === null) {
                // Check neighbors
                const neighbors = [
                    state.grid[r - 1]?.[c],
                    state.grid[r + 1]?.[c],
                    state.grid[r]?.[c - 1],
                    state.grid[r]?.[c + 1]
                ];
                if (neighbors.some(n => n !== undefined && n !== null)) {
                    return true;
                }
            }
        }
    }

    return false;
}

// Helper: Evaluate Ownership
export function evaluateOwnership(state: GameState) {
    // Rows
    for (let r = 0; r < state.grid.length; r++) {
        let redCubes = 0;
        let yellowCubes = 0;
        for (let c = 0; c < state.grid[r].length; c++) {
            const cell = state.grid[r][c];
            if (cell && cell.cubes && cell.owner) {
                if (cell.owner === 'red') redCubes += cell.cubes;
                else if (cell.owner === 'yellow') yellowCubes += cell.cubes;
            }
        }
        if (state.rowHeaders[r]) {
            if (redCubes > yellowCubes) state.rowHeaders[r].owner = 'red';
            else if (yellowCubes > redCubes) state.rowHeaders[r].owner = 'yellow';
        }
    }

    // Cols
    if (state.grid.length > 0) {
        for (let c = 0; c < state.grid[0].length; c++) {
            let redCubes = 0;
            let yellowCubes = 0;
            for (let r = 0; r < state.grid.length; r++) {
                const cell = state.grid[r][c];
                if (cell && cell.cubes && cell.owner) {
                    if (cell.owner === 'red') redCubes += cell.cubes;
                    else if (cell.owner === 'yellow') yellowCubes += cell.cubes;
                }
            }
            if (state.colHeaders[c]) {
                if (redCubes > yellowCubes) state.colHeaders[c].owner = 'red';
                else if (yellowCubes > redCubes) state.colHeaders[c].owner = 'yellow';
            }
        }
    }
}
