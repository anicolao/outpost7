import { createSlice, type PayloadAction, current } from '@reduxjs/toolkit';
import seedrandom from 'seedrandom';

export type PlayerColor = 'red' | 'yellow';
export type Edge = 'bottom' | 'top' | 'left' | 'right';


export interface Player {
    color: PlayerColor;
    edge: Edge;
}

// Re-export CardData as Card for consistency, or extend it
import type { CardData, BonusDefinition } from './cardLoader';
import type { GameSettings } from './settingsStore';
export type Card = CardData & { id: string; cubes?: number; owner?: PlayerColor; completedBonuses?: number[]; };

export interface PopulationCard {
    card: string; // filename
    count: number;
    owner: PlayerColor;
}

export type GamePhase = 'lobby' | 'playing' | 'game_over';

export interface BonusInstance {
    id: string;
    definition: BonusDefinition;
    sourceCardId: string;
    sourceRow: number;
    sourceCol: number;
    cubeSlot: number; // The slot (1-6) this bonus originated from
}

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
    currentPlayerHand?: Card[]; // Added for convenience or filtered from hands
    currentTurn: PlayerColor;
    turnCount: number;
    pendingBonuses: BonusInstance[];
    finishedPlayers: PlayerColor[];
    winner: PlayerColor | 'draw' | null;
    scores: { red: number; yellow: number };
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
    turnCount: 1, // Start at Turn 1 (Red)
    pendingBonuses: [],
    finishedPlayers: [],
    winner: null,
    scores: { red: 0, yellow: 0 },
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
            console.log('startGame called. Players:', state.players.length);
            if (state.players.length === 2) {
                state.phase = 'playing';
                state.finishedPlayers = [];
                state.winner = null;
                state.scores = { red: 0, yellow: 0 };


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

                // Draw required number of headers
                const requiredHeaders = rows + cols;
                const drawnHeaders = availableHeaders.slice(0, requiredHeaders);

                // Assign Owners
                const headersWithOwners: PopulationCard[] = drawnHeaders.map((d, i) => ({
                    ...d,
                    owner: (i % 2 === 0) ? 'red' : 'yellow'
                }));

                // Split into Cols (Top) and Rows (Left)
                state.colHeaders = headersWithOwners.slice(0, cols);
                state.rowHeaders = headersWithOwners.slice(cols, cols + rows);

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

                // Explicitly set Turn 1
                state.turnCount = 1;
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
        playCard: (state, action: PayloadAction<{ color: 'red' | 'yellow', playCardId: string, payCardId: string | null, row: number, col: number, settings: any }>) => {
            const { color, playCardId, payCardId, row, col, settings } = action.payload;
            const hand = state.hands[color];
            const playCardIndex = hand.findIndex(c => c.id === playCardId);

            if (playCardIndex === -1) return;

            const playCard = hand[playCardIndex];
            const payCard = hand.find(c => c.id === payCardId);

            if (playCard && payCard) {
                // Validate Rules
                if (payCard.cost < playCard.cost) {
                    console.warn(`Invalid Play: Pay Cost ${payCard.cost} < Play Cost ${playCard.cost}`);
                    return;
                }

                // Calculate Cubes
                // Rule: CUBES_PER_PLAY + (ColorMatch ? CUBES_PER_COLOR_MATCH : 0) + (Overpay * CUBES_PER_OVERPAYMENT)
                const colorMatch = payCard.color === playCard.color ? settings.CUBES_PER_COLOR_MATCH : 0;
                const overpay = Math.max(0, payCard.cost - playCard.cost);
                const overpayBonus = overpay * settings.CUBES_PER_OVERPAYMENT;
                const cubes = settings.CUBES_PER_PLAY + colorMatch + overpayBonus;

                // Remove both from hand
                // Remove both from hand
                state.hands[color] = hand.filter(c => c.id !== playCard.id && c.id !== payCardId);

                // Add pay card to discard
                state.discard.push(payCard);

                // Place play card on grid (Store Full Object + State)
                const newCard: Card = {
                    ...playCard,
                    cubes, // How many cubes to place
                    owner: color
                };
                state.grid[row][col] = newCard;

                // Check for BONUSES on the newly placed cubes
                if (newCard.bonuses) {
                    for (let i = 1; i <= cubes; i++) {
                        if (newCard.bonuses[i]) {
                            state.pendingBonuses.push({
                                id: Math.random().toString(36).substr(2, 9),
                                definition: newCard.bonuses[i],
                                sourceCardId: newCard.id,
                                sourceRow: row,
                                sourceCol: col,
                                cubeSlot: i
                            });
                        }
                    }
                }

                // Toggle Turn (only if no bonuses)
                if (state.pendingBonuses.length === 0) {
                    evaluateOwnership(state);
                    endTurn(state);
                }
            }
        },
        resolveBonus: (state, action: PayloadAction<{ bonusId: string }>) => {
            console.log('REDUCER: resolveBonus', action.payload);
            const { bonusId } = action.payload;
            const index = state.pendingBonuses.findIndex(b => b.id === bonusId);

            if (index === -1) {
                console.error('REDUCER: Bonus not found', bonusId);
                return;
            }

            const bonus = state.pendingBonuses[index];
            const { definition, sourceRow, sourceCol, cubeSlot } = bonus;
            console.log('REDUCER: Resolving bonus', { sourceRow, sourceCol, cubeSlot });

            // Mark as Completed on Source Card
            const sourceCard = state.grid[sourceRow]?.[sourceCol];
            if (sourceCard) {
                if (!sourceCard.completedBonuses) sourceCard.completedBonuses = [];
                if (!sourceCard.completedBonuses.includes(cubeSlot)) {
                    sourceCard.completedBonuses.push(cubeSlot);
                    console.log('REDUCER: Marked completed', sourceCard.completedBonuses);
                }
            } else {
                console.error('REDUCER: Source card not found');
            }

            const currentPlayer = state.currentTurn;

            // Execute Logic based on Type
            if (definition.type === 'ADD_CUBE') {
                // Helper to add cube
                const addCubeToCell = (r: number, c: number) => {
                    const cell = state.grid[r]?.[c]; // Safe check
                    if (!cell) return;

                    const isMine = cell.owner === currentPlayer;
                    const isNeutral = !cell.owner;

                    if (isMine || isNeutral) {
                        const currentCubes = cell.cubes || 0;
                        if (currentCubes < 6) {
                            cell.cubes = currentCubes + 1;
                            if (!cell.owner) cell.owner = currentPlayer;

                            // CASCADE: Check if new cube triggers bonus
                            if (cell.bonuses && cell.bonuses[cell.cubes]) {
                                state.pendingBonuses.push({
                                    id: Math.random().toString(36).substr(2, 9),
                                    definition: cell.bonuses[cell.cubes],
                                    sourceCardId: cell.id,
                                    sourceRow: r,
                                    sourceCol: c,
                                    cubeSlot: cell.cubes
                                });
                            }
                        }
                    }
                };

                // Row Scan
                for (let c = 0; c < state.grid[sourceRow].length; c++) {
                    addCubeToCell(sourceRow, c);
                }
                // Col Scan
                for (let r = 0; r < state.grid.length; r++) {
                    if (r !== sourceRow) addCubeToCell(r, sourceCol);
                }

            } else if (definition.type === 'REMOVE_CUBE') {
                const removeCubeFromCell = (r: number, c: number) => {
                    const cell = state.grid[r]?.[c];
                    if (!cell) return;

                    if (cell.owner && cell.owner !== currentPlayer) {
                        const currentCubes = cell.cubes || 0;
                        if (currentCubes > 0) {
                            // @ts-ignore - Check string key as fallback
                            const hasBonusProtected = cell.bonuses && (cell.bonuses[currentCubes] || cell.bonuses[String(currentCubes) as any]);
                            if (!hasBonusProtected) {
                                cell.cubes = currentCubes - 1;
                                if (cell.cubes === 0) cell.owner = undefined;
                            }
                        }
                    }
                };
                // Row Scan
                for (let c = 0; c < state.grid[sourceRow].length; c++) removeCubeFromCell(sourceRow, c);
                // Col Scan
                for (let r = 0; r < state.grid.length; r++) if (r !== sourceRow) removeCubeFromCell(r, sourceCol);

            } else if (definition.type === 'ADD_POPULATION') {
                const targetColor = definition.color;
                if (targetColor) {
                    let rowCount = 0;
                    for (let c = 0; c < state.grid[sourceRow].length; c++) {
                        const cell = state.grid[sourceRow][c];
                        if (cell && cell.color === targetColor) rowCount++;
                    }
                    if (state.rowHeaders[sourceRow]) state.rowHeaders[sourceRow].count += rowCount;

                    let colCount = 0;
                    for (let r = 0; r < state.grid.length; r++) {
                        const cell = state.grid[r][sourceCol];
                        if (cell && cell.color === targetColor) colCount++;
                    }
                    if (state.colHeaders[sourceCol]) state.colHeaders[sourceCol].count += colCount;
                }
            }

            // Remove executed bonus
            state.pendingBonuses.splice(index, 1);

            // Toggle Turn if all resolved
            if (state.pendingBonuses.length === 0) {
                evaluateOwnership(state);
                endTurn(state);
            }
        },
        resetGame: (state) => {
            return initialState;
        },
        salvage: (state, action: PayloadAction<{ color: PlayerColor, cardIds: string[] }>) => {
            const { color, cardIds } = action.payload;

            // Validation 1: Check Turn
            if (state.currentTurn !== color) {
                console.warn(`Salvage Failed: Not ${color}'s turn`);
                return;
            }

            // Validation 2: Check Cost limit (12)
            const selectedCards = state.offer.filter(c => cardIds.includes(c.id));
            if (selectedCards.length !== cardIds.length) {
                console.warn('Salvage Failed: Some cards not found in offer');
                return;
            }

            const totalCost = selectedCards.reduce((sum, c) => sum + c.cost, 0);
            if (totalCost > 12) {
                console.warn(`Salvage Failed: Total cost ${totalCost} > 12`);
                return;
            }

            // Validation 3: Check Hand Size Limit (7)
            const currentHandSize = state.hands[color].length;
            if (currentHandSize + selectedCards.length > 7) {
                console.warn(`Salvage Failed: Hand size would exceed 7`);
                return;
            }

            // Execute Salvage

            // 1. Add to Hand
            state.hands[color].push(...selectedCards);

            // 2. Remove from Offer
            state.offer = state.offer.filter(c => !cardIds.includes(c.id));

            // 3. Refill Offer (up to 5)
            const cardsNeeded = 5 - state.offer.length;
            if (cardsNeeded > 0 && state.deck.length > 0) {
                const drawn = state.deck.slice(0, cardsNeeded);
                state.deck = state.deck.slice(cardsNeeded);
                state.offer.push(...drawn);
            }

            // 4. End Turn
            endTurn(state);
        }
    },
});

// Helper: Evaluate Ownership
function evaluateOwnership(state: GameState) {
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

// Logic to check if a player has ANY valid moves
function hasValidMoves(state: GameState, player: PlayerColor): boolean {
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

function calculateScores(state: GameState): { red: number, yellow: number } {
    const scores = { red: 0, yellow: 0 };

    // Count population from Headers
    [...state.rowHeaders, ...state.colHeaders].forEach(h => {
        if (h.owner === 'red') scores.red += h.count;
        else if (h.owner === 'yellow') scores.yellow += h.count;
    });

    return scores;
}

function endTurn(state: GameState) {
    const currentPlayer = state.currentTurn;
    const otherPlayer = currentPlayer === 'red' ? 'yellow' : 'red';

    let nextPlayer = otherPlayer;
    let nextPlayerValid = hasValidMoves(state, nextPlayer);
    let currentPlayerValid = hasValidMoves(state, currentPlayer);

    // If next player is already finished, they stay finished.
    // If next player was playing but has no valid moves now, they become finished.
    if (!state.finishedPlayers.includes(nextPlayer)) {
        if (!nextPlayerValid) {
            state.finishedPlayers.push(nextPlayer);
        }
    }

    // Check if next player is finished (either previously or just now)
    if (state.finishedPlayers.includes(nextPlayer)) {
        // P2 cannot play. Control returns to P1 (Current Player)

        // Does P1 (Current) now have valid moves?
        // We know they just played, so maybe hand changed.
        currentPlayerValid = hasValidMoves(state, currentPlayer);

        if (!currentPlayerValid) {
            // P1 also cannot play. Game Over.
            if (!state.finishedPlayers.includes(currentPlayer)) {
                state.finishedPlayers.push(currentPlayer);
            }

            // GAME OVER
            state.phase = 'game_over';

            // Calculate Scores
            state.scores = calculateScores(state);

            if (state.scores.red > state.scores.yellow) state.winner = 'red';
            else if (state.scores.yellow > state.scores.red) state.winner = 'yellow';
            else {
                // Tiebreaker: Most cubes on board
                let redCubes = 0;
                let yellowCubes = 0;

                state.grid.flat().forEach(cell => {
                    if (cell && cell.cubes && cell.owner) {
                        if (cell.owner === 'red') redCubes += cell.cubes;
                        else if (cell.owner === 'yellow') yellowCubes += cell.cubes;
                    }
                });

                if (redCubes > yellowCubes) state.winner = 'red';
                else if (yellowCubes > redCubes) state.winner = 'yellow';
                else state.winner = 'draw';
            }
        } else {
            // P1 continues playing (Solo mode)
            state.currentTurn = currentPlayer;
            state.turnCount++;
        }
    } else {
        // Normal turn pass
        state.currentTurn = nextPlayer;
        state.turnCount++;
    }
}

export const { addPlayer, removePlayer, startGame, dealCards, playerDiscard, playCard, resolveBonus, resetGame, salvage } = gameSlice.actions;
export default gameSlice.reducer;
