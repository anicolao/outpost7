import type { GameSettings } from './settingsStore';
import type { Card } from './types';

export type RepairSettings = Pick<
    GameSettings,
    'CUBES_PER_PLAY' | 'CUBES_PER_COLOR_MATCH' | 'CUBES_PER_OVERPAYMENT'
>;

export function calculateRepairCubes(
    playCard: Card,
    payCard: Card,
    settings: RepairSettings,
): number {
    const colorMatch = payCard.color === playCard.color
        ? settings.CUBES_PER_COLOR_MATCH
        : 0;
    const overpayment = Math.max(0, payCard.cost - playCard.cost);
    const cubes = settings.CUBES_PER_PLAY
        + colorMatch
        + overpayment * settings.CUBES_PER_OVERPAYMENT;

    return Math.max(0, Math.min(cubes, playCard.maxCubes ?? 6));
}
