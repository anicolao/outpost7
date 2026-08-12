import { expect, test, type Locator, type Page } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';

const NUMBER_SETTINGS = {
    SALVAGE_MAX_COST: 2,
    CUBES_PER_COLOR_MATCH: 0,
    CUBES_PER_PLAY: 2,
    CUBES_PER_OVERPAYMENT: 0,
    GRID_ROWS: 3,
    GRID_COLS: 4,
    MAX_HAND_SIZE: 7,
    STARTING_HAND_SIZE: 7,
    BURN_CARD_COUNT: 2,
    OFFER_SIZE: 3,
    OPENING_HAND_VALUE_LIMIT_P1: 0,
    OPENING_HAND_VALUE_LIMIT_P2: 1,
} as const;

const ACTION_SETTING_KEYS = [
    'SALVAGE_MAX_COST',
    'CUBES_PER_COLOR_MATCH',
    'CUBES_PER_PLAY',
    'CUBES_PER_OVERPAYMENT',
] as const;

const SETUP_SETTING_KEYS = [
    'GRID_ROWS',
    'GRID_COLS',
    'MAX_HAND_SIZE',
    'STARTING_HAND_SIZE',
    'BURN_CARD_COUNT',
    'OFFER_SIZE',
    'OPENING_HAND_VALUE_LIMIT_P1',
    'OPENING_HAND_VALUE_LIMIT_P2',
] as const;

async function setNumber(row: Locator, target: number) {
    const value = row.locator('.value');
    let current = Number(await value.textContent());
    const direction = target < current ? '-' : '+';
    const button = row.getByRole('button', { name: direction, exact: true });

    while (current !== target) {
        await button.click();
        current += target < current ? -1 : 1;
        await expect(value).toHaveText(String(current));
    }
}

async function addPlayer(page: Page, edge: 'bottom' | 'top', color: 'red' | 'yellow') {
    await page.locator(`.edge-control.${edge} .add-btn`).click();
    await page.locator(`.edge-control.${edge} .color-btn[title="${color}"]`).click();
    await expect(page.locator(`.edge-control.${edge} .player-token`)).toBeVisible();
}

test('one settings snapshot governs setup, tabletop, and private hands', async ({ page, context }, testInfo) => {
    const helper = new TestStepHelper(page, testInfo);
    helper.setMetadata(
        'Authoritative Game Settings',
        '**As a** playtester, **I want** every configurable rule to follow one game settings snapshot, **so that** balance experiments behave consistently in every interface.',
    );
    const gameId = 'e2e_authoritative_settings';

    await page.goto(`/?seed=authoritative-settings&gameId=${gameId}`);
    await page.locator('.settings-btn.top-left').click();
    await expect(page.locator('.modal')).toBeVisible();

    await page.getByRole('button', { name: 'Setup rules' }).click();
    await page.locator('[data-setting-key="GRID_ROWS"] .value').selectOption(String(NUMBER_SETTINGS.GRID_ROWS));
    await page.locator('[data-setting-key="GRID_COLS"] .value').selectOption(String(NUMBER_SETTINGS.GRID_COLS));
    for (const key of SETUP_SETTING_KEYS.filter((key) => key !== 'GRID_ROWS' && key !== 'GRID_COLS')) {
        await setNumber(page.locator(`[data-setting-key="${key}"]`), NUMBER_SETTINGS[key]);
    }
    await page.locator('[data-setting-key="RANDOMIZE_BORDER_COLORS"] .toggle-btn').click();

    await helper.step('setup-rules-configured', {
        description: 'Every setup constant has a visible control',
        verifications: [
            {
                spec: 'All nine setup settings are represented',
                check: async () => await expect(page.locator('[data-setting-key]')).toHaveCount(9),
            },
            ...SETUP_SETTING_KEYS.map((key) => ({
                spec: `${key} is set to ${NUMBER_SETTINGS[key]}`,
                check: async () => {
                    const value = page.locator(`[data-setting-key="${key}"] .value`);
                    if (key === 'GRID_ROWS' || key === 'GRID_COLS') {
                        await expect(value).toHaveValue(String(NUMBER_SETTINGS[key]));
                    } else {
                        await expect(value).toHaveText(String(NUMBER_SETTINGS[key]));
                    }
                },
            })),
            {
                spec: 'Random border resource colours can be enabled',
                check: async () => await expect(
                    page.locator('[data-setting-key="RANDOMIZE_BORDER_COLORS"] .toggle-btn'),
                ).toHaveText('Allowed'),
            },
        ],
    });

    await page.getByRole('button', { name: 'Action rules' }).click();
    for (const key of ACTION_SETTING_KEYS) {
        await setNumber(page.locator(`[data-setting-key="${key}"]`), NUMBER_SETTINGS[key]);
    }
    await page.locator('[data-setting-key="ALLOW_ZERO_CUBE_REPAIRS"] .toggle-btn').click();

    await helper.step('action-rules-configured', {
        description: 'Every action constant has a visible control',
        verifications: [
            {
                spec: 'All five action settings are represented',
                check: async () => await expect(page.locator('[data-setting-key]')).toHaveCount(5),
            },
            ...ACTION_SETTING_KEYS.map((key) => ({
                spec: `${key} is set to ${NUMBER_SETTINGS[key]}`,
                check: async () => await expect(
                    page.locator(`[data-setting-key="${key}"] .value`),
                ).toHaveText(String(NUMBER_SETTINGS[key])),
            })),
            {
                spec: 'Zero-cube repairs can be explicitly enabled',
                check: async () => await expect(
                    page.locator('[data-setting-key="ALLOW_ZERO_CUBE_REPAIRS"] .toggle-btn'),
                ).toHaveText('Allowed'),
            },
        ],
    });

    await page.locator('.modal .close-btn').click();
    await addPlayer(page, 'bottom', 'red');
    await addPlayer(page, 'top', 'yellow');
    await page.locator('.play-btn').click();

    await helper.step('configured-game-created', {
        description: 'The game is created from the configured rules snapshot',
        verifications: [
            {
                spec: 'The tabletop uses a 3 by 4 grid and a three-card offer',
                check: async () => {
                    await expect(page.locator('.cell')).toHaveCount(12);
                    await expect(page.locator('.offer-container .card-wrapper')).toHaveCount(3);
                },
            },
            {
                spec: 'Burn, offer, and both starting hands use their configured counts',
                check: async () => {
                    const setup = await page.evaluate(() => {
                        // @ts-ignore E2E store exposure
                        const game = window.store.getState().game;
                        return {
                            settings: game.settings,
                            discard: game.discard.length,
                            offer: game.offer.length,
                            red: game.hands.red.length,
                            yellow: game.hands.yellow.length,
                        };
                    });
                    expect(setup).toEqual({
                        settings: {
                            ...NUMBER_SETTINGS,
                            ALLOW_ZERO_CUBE_REPAIRS: true,
                            RANDOMIZE_BORDER_COLORS: true,
                        },
                        discard: 2,
                        offer: 3,
                        red: 7,
                        yellow: 7,
                    });
                    await expect(page.locator('.header-resource-icon')).toHaveCount(7);
                },
            },
        ],
    });

    await page.locator('.offer-container .card-wrapper').first().click();
    await helper.step('tabletop-rules-applied', {
        description: 'Tabletop actions use the same configured limits',
        verifications: [
            {
                spec: 'Salvage displays the configured value and hand-size limits',
                check: async () => {
                    await expect(page.locator('.stats-pill .cost')).toContainText('/2');
                    await expect(page.locator('.stats-pill .count')).toContainText('/7');
                    await expect(page.locator('.salvage-btn')).toBeDisabled();
                },
            },
        ],
    });

    const redPage = await context.newPage();
    await redPage.goto(`/#/hand?game=${gameId}&color=red`);
    await helper.step('private-hand-rules-applied', {
        description: 'The private hand receives the game rules snapshot',
        page: redPage,
        verifications: [
            {
                spec: 'The configured seven-card hand is synchronized',
                check: async () => {
                    await expect(redPage.locator('.status')).toHaveText('Connected');
                    await expect(redPage.locator('.card-wrapper')).toHaveCount(7);
                },
            },
            {
                spec: 'The private UI displays the configured hand and opening-value limits',
                check: async () => {
                    await expect(redPage.locator('.stat', { hasText: 'Cards:' })).toContainText('/7');
                    await expect(redPage.locator('.stat', { hasText: 'Value:' })).toContainText('/0');
                    await expect(redPage.locator('.alert-banner')).toBeVisible();
                },
            },
        ],
    });

    helper.generateDocs();
});
