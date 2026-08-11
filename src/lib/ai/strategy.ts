import { evaluateOwnership } from '../gameUtils';
import { calculateRepairCubes, type RepairSettings } from '../repairRules';
import type { Card, GameState, PlayerColor, PopulationCard } from '../types';
import { legalPlacements } from '../placementRules';

function otherPlayer(player: PlayerColor): PlayerColor {
    return player === 'red' ? 'yellow' : 'red';
}

function projectPlacement(
    state: GameState,
    card: Card,
    cubes: number,
    row: number,
    col: number,
    owner: PlayerColor,
): GameState {
    const projected: GameState = {
        ...state,
        grid: state.grid.map(gridRow => gridRow.map(cell => cell ? { ...cell } : null)),
        rowHeaders: state.rowHeaders.map(header => ({ ...header })),
        colHeaders: state.colHeaders.map(header => ({ ...header })),
    };

    projected.grid[row][col] = { ...card, cubes, owner };
    evaluateOwnership(projected);
    return projected;
}

function lineScore(
    cells: Array<Card | null>,
    header: PopulationCard | undefined,
    perspective: PlayerColor,
): number {
    if (!header) return 0;

    const opponent = otherPlayer(perspective);
    const ownCubes = cells.reduce(
        (sum, cell) => sum + (cell?.owner === perspective ? cell.cubes ?? 0 : 0),
        0,
    );
    const opponentCubes = cells.reduce(
        (sum, cell) => sum + (cell?.owner === opponent ? cell.cubes ?? 0 : 0),
        0,
    );
    const ownershipScore = header.owner === perspective
        ? header.count * 500
        : header.owner === opponent
            ? header.count * -500
            : 0;
    const marginScore = (ownCubes - opponentCubes) * (header.count + 1) * 10;

    return ownershipScore + marginScore;
}

function positionScore(state: GameState, perspective: PlayerColor): number {
    let score = 0;

    for (let row = 0; row < state.grid.length; row++) {
        score += lineScore(state.grid[row], state.rowHeaders[row], perspective);
    }

    const columnCount = state.grid[0]?.length ?? 0;
    for (let col = 0; col < columnCount; col++) {
        score += lineScore(
            state.grid.map(row => row[col]),
            state.colHeaders[col],
            perspective,
        );
    }

    return score;
}

function strongestReply(
    state: GameState,
    perspective: PlayerColor,
    settings: RepairSettings,
): number {
    const opponent = otherPlayer(perspective);
    const hand = state.hands[opponent];
    let bestCard: Card | null = null;
    let maxCubes = 0;

    for (let playIndex = 0; playIndex < hand.length; playIndex++) {
        for (let payIndex = 0; payIndex < hand.length; payIndex++) {
            if (playIndex === payIndex) continue;
            const playCard = hand[playIndex];
            const payCard = hand[payIndex];
            if (payCard.cost < playCard.cost) continue;

            const cubes = calculateRepairCubes(playCard, payCard, settings);
            if (cubes > maxCubes) {
                maxCubes = cubes;
                bestCard = playCard;
            }
        }
    }

    if (!bestCard || maxCubes === 0) return 0;

    const currentScore = positionScore(state, perspective);
    let worstReplyScore = currentScore;
    for (const placement of legalPlacements(state.grid)) {
        const reply = projectPlacement(
            state,
            bestCard,
            maxCubes,
            placement.row,
            placement.col,
            opponent,
        );
        worstReplyScore = Math.min(worstReplyScore, positionScore(reply, perspective));
    }

    return worstReplyScore - currentScore;
}

export function evaluateStrategicPlacement(
    state: GameState,
    playCard: Card,
    payCard: Card,
    row: number,
    col: number,
    perspective: PlayerColor,
    settings: RepairSettings,
): number {
    const cubes = calculateRepairCubes(playCard, payCard, settings);
    const projected = projectPlacement(state, playCard, cubes, row, col, perspective);
    const immediateSwing = positionScore(projected, perspective) - positionScore(state, perspective);

    return immediateSwing + strongestReply(projected, perspective, settings);
}
