/**
 * Basic AI Implementation: "The Scrapper"
 * 
 * This AI follows a greedy strategy with 1-ply lookahead.
 * It prioritizes winning votes (population control) over just placing pieces.
 */

import type { PlayerColor, Card, PopulationCard } from '../gameSlice';

export interface GameState {
    grid: (Card | null)[][];
    rowHeaders: PopulationCard[];
    colHeaders: PopulationCard[];
    hands: Record<PlayerColor, Card[]>;
    offer: Card[];
    deck: Card[];
    currentTurn: PlayerColor;
}

export type AIMove =
    | { type: 'PASS' }
    | { type: 'SALVAGE', cardIds: string[] }
    | { type: 'REPAIR', playCardId: string, discardCardId: string, row: number, col: number };

/**
 * Compute the best move for the AI player
 */
export function computeAIMove(state: GameState): AIMove {
    const myColor = state.currentTurn;
    const myHand = state.hands[myColor];

    // Try to find the best repair move
    const repairMove = findBestRepairMove(state, myColor);
    
    // If we have a good repair move, use it
    if (repairMove && repairMove.score > 0) {
        return {
            type: 'REPAIR',
            playCardId: repairMove.playCardId,
            discardCardId: repairMove.discardCardId,
            row: repairMove.row,
            col: repairMove.col
        };
    }

    // Otherwise, try to salvage
    const salvageMove = findBestSalvageMove(state, myColor);
    if (salvageMove) {
        return {
            type: 'SALVAGE',
            cardIds: salvageMove.cardIds
        };
    }

    // If we can't do anything, pass
    return { type: 'PASS' };
}

interface RepairCandidate {
    playCardId: string;
    discardCardId: string;
    row: number;
    col: number;
    score: number;
}

/**
 * Find the best repair (play card) move
 */
function findBestRepairMove(state: GameState, myColor: PlayerColor): RepairCandidate | null {
    const myHand = state.hands[myColor];
    
    if (myHand.length < 2) {
        return null; // Need at least 2 cards to repair
    }

    const validSpots = getValidGridPositions(state.grid);
    if (validSpots.length === 0) {
        return null;
    }

    let bestMove: RepairCandidate | null = null;
    let bestScore = -Infinity;

    // Try all combinations
    for (const playCard of myHand) {
        for (const discardCard of myHand) {
            if (playCard.id === discardCard.id) continue;
            if (discardCard.cost < playCard.cost) continue; // Invalid cost

            for (const [row, col] of validSpots) {
                const score = evaluateRepairMove(state, myColor, playCard, discardCard, row, col);
                
                if (score > bestScore) {
                    bestScore = score;
                    bestMove = {
                        playCardId: playCard.id,
                        discardCardId: discardCard.id,
                        row,
                        col,
                        score
                    };
                }
            }
        }
    }

    return bestMove;
}

/**
 * Get all valid positions where a card can be placed
 */
function getValidGridPositions(grid: (Card | null)[][]): [number, number][] {
    const positions: [number, number][] = [];
    
    // Check if grid is empty
    let hasCards = false;
    for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < grid[r].length; c++) {
            if (grid[r][c] !== null) {
                hasCards = true;
                break;
            }
        }
        if (hasCards) break;
    }

    // If empty, all positions are valid
    if (!hasCards) {
        for (let r = 0; r < grid.length; r++) {
            for (let c = 0; c < grid[r].length; c++) {
                positions.push([r, c]);
            }
        }
        return positions;
    }

    // Otherwise, only empty spots adjacent to existing cards
    for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < grid[r].length; c++) {
            if (grid[r][c] === null) {
                // Check if adjacent to any card
                const hasAdjacentCard = (
                    (r > 0 && grid[r - 1][c] !== null) ||
                    (r < grid.length - 1 && grid[r + 1][c] !== null) ||
                    (c > 0 && grid[r][c - 1] !== null) ||
                    (c < grid[r].length - 1 && grid[r][c + 1] !== null)
                );
                
                if (hasAdjacentCard) {
                    positions.push([r, c]);
                }
            }
        }
    }

    return positions;
}

/**
 * Evaluate the value of a repair move
 */
function evaluateRepairMove(
    state: GameState,
    myColor: PlayerColor,
    playCard: Card,
    discardCard: Card,
    row: number,
    col: number
): number {
    // Calculate cubes that would be placed
    const colorMatch = discardCard.color === playCard.color ? 1 : 0;
    const overpay = Math.max(0, discardCard.cost - playCard.cost);
    const cubes = 1 + colorMatch + overpay; // CUBES_PER_PLAY (1) + colorMatch + overpay

    // Evaluate the position value
    let score = cubes * 10; // Base score for placing cubes

    // Add value for rows/columns with high population
    const rowPopulation = state.rowHeaders[row]?.count || 0;
    const colPopulation = state.colHeaders[col]?.count || 0;
    score += rowPopulation * 5;
    score += colPopulation * 5;

    // Add value if we're winning or close to winning this row/column
    const rowOwner = state.rowHeaders[row]?.owner;
    const colOwner = state.colHeaders[col]?.owner;
    
    if (rowOwner === myColor) {
        score += rowPopulation * 10; // Strengthen our position
    } else {
        // Check if we can flip it
        const rowCubes = countCubesInRow(state.grid, row, myColor);
        const opponentColor = myColor === 'red' ? 'yellow' : 'red';
        const opponentRowCubes = countCubesInRow(state.grid, row, opponentColor);
        if (rowCubes + cubes > opponentRowCubes) {
            score += rowPopulation * 20; // Big bonus for flipping
        }
    }

    if (colOwner === myColor) {
        score += colPopulation * 10;
    } else {
        const colCubes = countCubesInCol(state.grid, col, myColor);
        const opponentColor = myColor === 'red' ? 'yellow' : 'red';
        const opponentColCubes = countCubesInCol(state.grid, col, opponentColor);
        if (colCubes + cubes > opponentColCubes) {
            score += colPopulation * 20;
        }
    }

    // Prefer playing lower cost cards to save higher cards for later
    score -= playCard.cost * 2;

    return score;
}

/**
 * Count cubes in a row for a specific player
 */
function countCubesInRow(grid: (Card | null)[][], row: number, color: PlayerColor): number {
    let count = 0;
    for (let c = 0; c < grid[row].length; c++) {
        const card = grid[row][c];
        if (card && card.owner === color && card.cubes) {
            count += card.cubes;
        }
    }
    return count;
}

/**
 * Count cubes in a column for a specific player
 */
function countCubesInCol(grid: (Card | null)[][], col: number, color: PlayerColor): number {
    let count = 0;
    for (let r = 0; r < grid.length; r++) {
        const card = grid[r][col];
        if (card && card.owner === color && card.cubes) {
            count += card.cubes;
        }
    }
    return count;
}

/**
 * Find the best salvage (draw cards) move
 */
function findBestSalvageMove(state: GameState, myColor: PlayerColor): { cardIds: string[] } | null {
    const myHand = state.hands[myColor];
    const offer = state.offer;

    if (myHand.length >= 7) {
        return null; // Hand is full
    }

    if (offer.length === 0) {
        return null; // Nothing to salvage
    }

    // Find the best combination of cards up to value 12
    const maxCost = 12;
    const maxCards = Math.min(7 - myHand.length, offer.length);

    let bestCombination: Card[] = [];
    let bestValue = 0;

    // Try all combinations (simple greedy approach)
    // Sort by cost descending to prefer high-value cards
    const sortedOffer = [...offer].sort((a, b) => b.cost - a.cost);

    // Greedy: take highest value cards that fit
    const combination: Card[] = [];
    let totalCost = 0;

    for (const card of sortedOffer) {
        if (totalCost + card.cost <= maxCost && combination.length < maxCards) {
            combination.push(card);
            totalCost += card.cost;
        }
    }

    if (combination.length > 0) {
        return {
            cardIds: combination.map(c => c.id)
        };
    }

    return null;
}
