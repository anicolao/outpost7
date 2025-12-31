import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
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

export type GamePhase = 'lobby' | 'playing';

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
                    state.currentTurn = state.currentTurn === 'red' ? 'yellow' : 'red';
                    state.turnCount++;
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
                state.currentTurn = state.currentTurn === 'red' ? 'yellow' : 'red';
                state.turnCount++;
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
            state.currentTurn = state.currentTurn === 'red' ? 'yellow' : 'red';
            state.turnCount++;
        }
    },
});

export const { addPlayer, removePlayer, startGame, dealCards, playerDiscard, playCard, resolveBonus, resetGame, salvage } = gameSlice.actions;
export default gameSlice.reducer;
