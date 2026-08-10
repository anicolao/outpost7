import { createSlice, type PayloadAction, current } from '@reduxjs/toolkit';
import type { CardData, BonusDefinition } from './cardLoader';
import { DEFAULT_GAME_SETTINGS, type GameSettings } from './settingsStore';
import { createSeededRandom } from './random';
import type {
    PlayerColor,
    Edge,
    Player,
    Card,
    PopulationCard,
    GamePhase,
    BonusInstance,
    GameState
} from './types';
import { hasValidMoves, evaluateOwnership } from './gameUtils';
import { calculateRepairCubes } from './repairRules';

// Export types for potential external use (consistency)
export type { PlayerColor, Edge, Player, Card, PopulationCard, GamePhase, BonusInstance, GameState };


const initialState: GameState = {
    seed: '',
    settings: { ...DEFAULT_GAME_SETTINGS },
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
    bonusIdCounter: 0,
};

const gameSlice = createSlice({
    name: 'game',
    initialState,
    reducers: {
        addPlayer: (state, action: PayloadAction<{ color: PlayerColor, edge: Edge, type?: 'human' | 'ai' }>) => {
            const { color, edge, type = 'human' } = action.payload;
            const edgeOccupied = state.players.some(p => p.edge === edge);
            const colorTaken = state.players.some(p => p.color === color);

            if (!edgeOccupied && !colorTaken) {
                state.players.push({ color, edge, type });
            }
        },
        removePlayer: (state, action: PayloadAction<Edge>) => {
            state.players = state.players.filter(p => p.edge !== action.payload);
        },
        startGame: (state, action: PayloadAction<{
            deck?: Card[];
            headers?: Card[];
            seed: string;
            settings: GameSettings;
        }>) => {
            console.log('startGame called. Players:', state.players.length);
            if (state.players.length === 2) {
                state.settings = { ...action.payload.settings };
                state.phase = 'playing';
                state.finishedPlayers = [];
                state.winner = null;
                state.scores = { red: 0, yellow: 0 };
                state.bonusIdCounter = 0; // Reset counter


                // Initialize RNG
                state.seed = action.payload.seed;
                const rng = createSeededRandom(state.seed);

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
                const { GRID_ROWS: rows, GRID_COLS: cols } = state.settings;
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

                const burnCount = state.settings.BURN_CARD_COUNT;
                const offerSize = state.settings.OFFER_SIZE;
                const startingHandSize = state.settings.STARTING_HAND_SIZE;

                state.discard = deckCards.slice(0, burnCount);
                let currentDeck = deckCards.slice(burnCount);

                state.offer = currentDeck.slice(0, offerSize);
                currentDeck = currentDeck.slice(offerSize);

                state.hands.red = currentDeck.slice(0, startingHandSize);
                state.hands.yellow = currentDeck.slice(startingHandSize, startingHandSize * 2);
                state.deck = currentDeck.slice(startingHandSize * 2);

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

            const isOpeningTurn = (color === 'red' && state.turnCount === 1)
                || (color === 'yellow' && state.turnCount === 2);
            const valueLimit = color === 'red'
                ? state.settings.OPENING_HAND_VALUE_LIMIT_P1
                : state.settings.OPENING_HAND_VALUE_LIMIT_P2;
            const handValue = hand.reduce((total, card) => total + card.cost, 0);
            const newHandValue = newHand.reduce((total, card) => total + card.cost, 0);
            const discardRequired = hand.length > state.settings.MAX_HAND_SIZE
                || (isOpeningTurn && handValue > valueLimit);
            const discardSatisfiesRules = newHand.length <= state.settings.MAX_HAND_SIZE
                && (!isOpeningTurn || newHandValue <= valueLimit);

            if (
                state.currentTurn !== color
                || cardIds.length === 0
                || toDiscard.length !== new Set(cardIds).size
                || !discardRequired
                || !discardSatisfiesRules
            ) return;

            state.hands[color] = newHand;
            state.discard.push(...toDiscard);
        },
        playCard: (state, action: PayloadAction<{
            color: PlayerColor;
            playCardId: string;
            payCardId: string | null;
            row: number;
            col: number;
        }>) => {
            const { color, playCardId, payCardId, row, col } = action.payload;
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
                const cubes = calculateRepairCubes(playCard, payCard, state.settings);
                if (cubes === 0 && !state.settings.ALLOW_ZERO_CUBE_REPAIRS) {
                    console.warn('Invalid Play: Cards played with zero cubes are disabled');
                    return;
                }

                // Remove both from hand
                // Remove both from hand
                state.hands[color] = hand.filter(c => c.id !== playCard.id && c.id !== payCardId);

                // Add pay card to discard
                state.discard.push(payCard);

                // Place play card on grid (Store Full Object + State)
                const newCard: Card = {
                    ...playCard,
                    cubes,
                    owner: cubes > 0 ? color : undefined,
                };
                state.grid[row][col] = newCard;

                // Check for BONUSES on the newly placed cubes
                if (newCard.bonuses) {
                    for (let i = 1; i <= cubes; i++) {
                        if (newCard.bonuses[i]) {
                            state.bonusIdCounter = (state.bonusIdCounter || 0) + 1;
                            const newBonusId = `bonus_${state.bonusIdCounter}`;
                            state.pendingBonuses.push({
                                id: newBonusId,
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
                        const maxCubes = cell.maxCubes !== undefined ? cell.maxCubes : 6;
                        if (currentCubes < maxCubes) {
                            cell.cubes = currentCubes + 1;
                            if (!cell.owner) cell.owner = currentPlayer;

                            // CASCADE: Check if new cube triggers bonus
                            if (cell.bonuses && cell.bonuses[cell.cubes]) {
                                state.bonusIdCounter = (state.bonusIdCounter || 0) + 1;
                                const newCascadeId = `bonus_${state.bonusIdCounter}`;
                                state.pendingBonuses.push({
                                    id: newCascadeId,
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
        passTurn: (state, action: PayloadAction<{ color: PlayerColor }>) => {
            const { color } = action.payload;
            if (state.currentTurn !== color) return;

            // Optional: stricter check "if hasValidMoves(state, color) => throw/ignore" ?
            // For now, allow voluntary pass, or assume caller checked.
            // But we should mark them as finished if they pass?
            // "When a player cannot play... they pass... once a player has passed, they are out of the round"
            if (!state.finishedPlayers.includes(color)) {
                state.finishedPlayers.push(color);
            }
            endTurn(state);
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

            // Validation 2: Check configured cost limit
            const selectedCards = state.offer.filter(c => cardIds.includes(c.id));
            if (selectedCards.length !== cardIds.length) {
                console.warn('Salvage Failed: Some cards not found in offer');
                return;
            }

            const totalCost = selectedCards.reduce((sum, c) => sum + c.cost, 0);
            if (totalCost > state.settings.SALVAGE_MAX_COST) {
                console.warn(
                    `Salvage Failed: Total cost ${totalCost} > ${state.settings.SALVAGE_MAX_COST}`,
                );
                return;
            }

            // Validation 3: Check configured hand size limit
            const currentHandSize = state.hands[color].length;
            if (currentHandSize + selectedCards.length > state.settings.MAX_HAND_SIZE) {
                console.warn(
                    `Salvage Failed: Hand size would exceed ${state.settings.MAX_HAND_SIZE}`,
                );
                return;
            }

            // Execute Salvage

            // 1. Add to Hand
            state.hands[color].push(...selectedCards);

            // 2. Remove from Offer
            state.offer = state.offer.filter(c => !cardIds.includes(c.id));

            // 3. Refill the configured offer
            const cardsNeeded = state.settings.OFFER_SIZE - state.offer.length;
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
    const otherPlayer: PlayerColor = currentPlayer === 'red' ? 'yellow' : 'red';

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

export const { addPlayer, removePlayer, startGame, dealCards, playerDiscard, playCard, resolveBonus, passTurn, resetGame, salvage } = gameSlice.actions;
export default gameSlice.reducer;
