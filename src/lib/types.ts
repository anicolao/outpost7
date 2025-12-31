import type { CardData, BonusDefinition } from './cardLoader';

export type PlayerColor = 'red' | 'yellow';
export type Edge = 'bottom' | 'top' | 'left' | 'right';

export interface Player {
    color: PlayerColor;
    edge: Edge;
}

export type Card = CardData & { id: string; cubes?: number; owner?: PlayerColor; completedBonuses?: number[]; };

export interface PopulationCard {
    card: string; // filename
    count: number;
    owner?: PlayerColor;
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

export interface GameState {
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
    bonusIdCounter: number;
}
