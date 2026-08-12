import { writable } from 'svelte/store';

export interface GameSettings {
    SALVAGE_MAX_COST: number;
    CUBES_PER_COLOR_MATCH: number;
    CUBES_PER_PLAY: number;
    CUBES_PER_OVERPAYMENT: number;
    GRID_ROWS: number;
    GRID_COLS: number;
    MAX_HAND_SIZE: number;
    STARTING_HAND_SIZE: number;
    BURN_CARD_COUNT: number;
    OFFER_SIZE: number;
    OPENING_HAND_VALUE_LIMIT_P1: number;
    OPENING_HAND_VALUE_LIMIT_P2: number;
    ALLOW_ZERO_CUBE_REPAIRS: boolean;
    RANDOMIZE_BORDER_COLORS: boolean;
}

export const DEFAULT_GAME_SETTINGS: GameSettings = {
    SALVAGE_MAX_COST: 12,
    CUBES_PER_COLOR_MATCH: 1,
    CUBES_PER_PLAY: 0,
    CUBES_PER_OVERPAYMENT: 1,
    GRID_ROWS: 5,
    GRID_COLS: 5,
    MAX_HAND_SIZE: 7,
    STARTING_HAND_SIZE: 5,
    BURN_CARD_COUNT: 10,
    OFFER_SIZE: 5,
    OPENING_HAND_VALUE_LIMIT_P1: 12,
    OPENING_HAND_VALUE_LIMIT_P2: 16,
    ALLOW_ZERO_CUBE_REPAIRS: false,
    RANDOMIZE_BORDER_COLORS: false,
};

type SettingDefinition = {
    label: string;
} & (
    | { type: 'number'; min: number; max: number }
    | { type: 'select'; options: readonly number[] }
    | { type: 'boolean' }
);

export const GAME_SETTING_DEFINITIONS: Record<keyof GameSettings, SettingDefinition> = {
    SALVAGE_MAX_COST: {
        label: 'Maximum Salvage Value',
        type: 'number',
        min: 0,
        max: 30,
    },
    CUBES_PER_COLOR_MATCH: {
        label: 'Cubes gained for color match',
        type: 'number',
        min: 0,
        max: 6,
    },
    CUBES_PER_PLAY: {
        label: 'Cubes gained for playing a card',
        type: 'number',
        min: 0,
        max: 6,
    },
    CUBES_PER_OVERPAYMENT: {
        label: 'Cubes gained per point of overpayment',
        type: 'number',
        min: 0,
        max: 6,
    },
    GRID_ROWS: {
        label: 'Grid Rows',
        type: 'select',
        options: [2, 3, 4, 5, 6],
    },
    GRID_COLS: {
        label: 'Grid Columns',
        type: 'select',
        options: [2, 3, 4, 5, 6],
    },
    MAX_HAND_SIZE: {
        label: 'Maximum Cards in Hand',
        type: 'number',
        min: 1,
        max: 12,
    },
    STARTING_HAND_SIZE: {
        label: 'Starting Cards in Hand',
        type: 'number',
        min: 1,
        max: 12,
    },
    BURN_CARD_COUNT: {
        label: 'Cards Discarded Before Setup',
        type: 'number',
        min: 0,
        max: 30,
    },
    OFFER_SIZE: {
        label: 'Face-up Module Cards',
        type: 'number',
        min: 1,
        max: 8,
    },
    OPENING_HAND_VALUE_LIMIT_P1: {
        label: 'Opening Hand Value Limit (P1)',
        type: 'number',
        min: 0,
        max: 30,
    },
    OPENING_HAND_VALUE_LIMIT_P2: {
        label: 'Opening Hand Value Limit (P2)',
        type: 'number',
        min: 0,
        max: 30,
    },
    ALLOW_ZERO_CUBE_REPAIRS: {
        label: 'Allow cards played with zero cubes',
        type: 'boolean',
    },
    RANDOMIZE_BORDER_COLORS: {
        label: 'Random resource colours on border cards',
        type: 'boolean',
    },
};

function createSettingsStore() {
    const { subscribe, set, update } = writable<GameSettings>({ ...DEFAULT_GAME_SETTINGS });

    return {
        subscribe,
        set,
        updateSetting: <Key extends keyof GameSettings>(key: Key, value: GameSettings[Key]) => {
            update(settings => ({ ...settings, [key]: value }));
        },
        reset: () => set({ ...DEFAULT_GAME_SETTINGS }),
    };
}

export const settingsStore = createSettingsStore();
