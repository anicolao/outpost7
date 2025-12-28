import { writable } from 'svelte/store';

export interface GameSettings {
    SALVAGE_MAX_COST: number;
    CUBES_PER_COLOR_MATCH: number;
    CUBES_PER_PLAY: number;
    CUBES_PER_OVERPAYMENT: number;
    GRID_ROWS: number;
    GRID_COLS: number;
}

const DEFAULT_SETTINGS: GameSettings = {
    SALVAGE_MAX_COST: 12,
    CUBES_PER_COLOR_MATCH: 1,
    CUBES_PER_PLAY: 0,
    CUBES_PER_OVERPAYMENT: 1,
    GRID_ROWS: 5,
    GRID_COLS: 5,
};

export const SETTINGS_DESCRIPTIONS = {
    SALVAGE_MAX_COST: "Max cost of cards card sum in Salvage phase",
    CUBES_PER_COLOR_MATCH: "Cubes gained for color match",
    CUBES_PER_PLAY: "Cubes gained for playing a card",
    CUBES_PER_OVERPAYMENT: "Cubes gained per point of overpayment",
    GRID_ROWS: "Grid Rows",
    GRID_COLS: "Grid Columns",
};

function createSettingsStore() {
    const { subscribe, set, update } = writable<GameSettings>(DEFAULT_SETTINGS);

    return {
        subscribe,
        set,
        updateSetting: (key: keyof GameSettings, value: number) => {
            update(s => ({ ...s, [key]: value }));
        },
        reset: () => set(DEFAULT_SETTINGS)
    };
}

export const settingsStore = createSettingsStore();
