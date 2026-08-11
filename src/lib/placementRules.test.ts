import { describe, expect, it } from 'vitest';
import { isLegalPlacement, legalPlacements } from './placementRules';

describe('space-station placement', () => {
    it('allows the first card in any empty grid cell', () => {
        const grid = Array.from({ length: 3 }, () => Array(3).fill(null));

        expect(legalPlacements(grid)).toHaveLength(9);
        expect(isLegalPlacement(grid, 0, 0)).toBe(true);
        expect(isLegalPlacement(grid, 2, 2)).toBe(true);
    });

    it('allows later cards only in orthogonally adjacent empty cells', () => {
        const grid = Array.from({ length: 3 }, () => Array(3).fill(null));
        grid[1][1] = { id: 'station-card' };

        expect(legalPlacements(grid)).toEqual([
            { row: 0, col: 1 },
            { row: 1, col: 0 },
            { row: 1, col: 2 },
            { row: 2, col: 1 },
        ]);
        expect(isLegalPlacement(grid, 0, 0)).toBe(false);
        expect(isLegalPlacement(grid, 1, 1)).toBe(false);
        expect(isLegalPlacement(grid, -1, 1)).toBe(false);
    });
});
