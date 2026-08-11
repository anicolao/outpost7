type PlacementGrid = ReadonlyArray<ReadonlyArray<unknown | null>>;

function isGridEmpty(grid: PlacementGrid) {
    return grid.every(row => row.every(cell => cell === null));
}

export function isLegalPlacement(grid: PlacementGrid, row: number, col: number) {
    if (grid[row]?.[col] === undefined || grid[row][col] !== null) return false;
    if (isGridEmpty(grid)) return true;

    return [
        grid[row - 1]?.[col],
        grid[row + 1]?.[col],
        grid[row]?.[col - 1],
        grid[row]?.[col + 1],
    ].some(cell => cell !== undefined && cell !== null);
}

export function legalPlacements(grid: PlacementGrid) {
    const placements: Array<{ row: number; col: number }> = [];

    for (let row = 0; row < grid.length; row++) {
        for (let col = 0; col < grid[row].length; col++) {
            if (isLegalPlacement(grid, row, col)) placements.push({ row, col });
        }
    }

    return placements;
}
