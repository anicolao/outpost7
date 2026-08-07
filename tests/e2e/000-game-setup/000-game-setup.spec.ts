import { test, expect } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';

test.beforeEach(({ page }) => {
    page.on('console', msg => console.log(`BROWSER LOG: ${msg.text()}`));
    page.on('pageerror', err => console.log(`BROWSER ERROR: ${err}`));
});

test('Game Setup Flow', async ({ page }, testInfo) => {
    const tester = new TestStepHelper(page, testInfo);
    tester.setMetadata(
        'Game Setup',
        '**As a** player, **I want** to join the lobby and start the game, **so that** I can play.'
    );

    // Navigate
    await page.goto('/?seed=e2e_test&gameId=e2e_host_setup');

    await tester.step('lobby-initial', {
        description: 'Lobby - Initial State',
        verifications: [
            {
                spec: 'Lobby should display 4 edge controls',
                check: async () => {
                    await expect(page.locator('.edge-control.bottom .add-btn')).toBeVisible();
                    await expect(page.locator('.edge-control.top .add-btn')).toBeVisible();
                }
            },
            {
                spec: 'Play button should be hidden or inactive initially',
                check: async () => await expect(page.locator('.play-btn')).not.toBeVisible() // Or check for waiting message
            }
        ]
    });

    // Add Player 1
    await page.locator('.edge-control.bottom .add-btn').click();

    await tester.step('lobby-p1-selecting', {
        description: 'Lobby - Player 1 Choosing Color',
        verifications: [
            {
                spec: 'Color picker should appear for bottom player',
                check: async () => {
                    await expect(page.locator('.edge-control.bottom .add-btn')).toBeHidden();
                    await expect(page.locator('.edge-control.bottom .color-picker')).toBeVisible();
                }
            }
        ]
    });

    // Select Red
    await page.locator('.edge-control.bottom .color-btn[title="red"]').click();

    await tester.step('lobby-p1-joined', {
        description: 'Lobby - Player 1 Joined',
        verifications: [
            {
                spec: 'Bottom player token should appear',
                check: async () => await expect(page.locator('.edge-control.bottom .player-token')).toBeVisible()
            },
            {
                spec: 'Bottom player should be Red',
                check: async () => await expect(page.locator('.edge-control.bottom .player-token')).toHaveCSS('background-color', 'rgb(255, 77, 77)')
            }
        ]
    });

    // Add Player 2
    await page.locator('.edge-control.top .add-btn').click();

    await tester.step('lobby-p2-selecting', {
        description: 'Lobby - Player 2 Choosing Color',
        verifications: [
            {
                spec: 'Color picker should appear for top player',
                check: async () => {
                    await expect(page.locator('.edge-control.top .add-btn')).toBeHidden();
                    const picker = page.locator('.edge-control.top .color-picker');
                    await expect(picker).toBeVisible();
                }
            }
        ]
    });

    // Select Yellow
    await page.locator('.edge-control.top .color-btn[title="yellow"]').click();

    await tester.step('lobby-p2-joined', {
        description: 'Lobby - Player 2 Joined',
        verifications: [
            {
                spec: 'Top player token should appear',
                check: async () => await expect(page.locator('.edge-control.top .player-token')).toBeVisible()
            },
            {
                spec: 'Top player should be Yellow',
                check: async () => await expect(page.locator('.edge-control.top .player-token')).toHaveCSS('background-color', 'rgb(255, 215, 0)')
            },
            {
                spec: 'Play button should now be visible',
                check: async () => await expect(page.locator('.play-btn')).toBeVisible()
            }
        ]
    });

    // Start Game
    await page.locator('.play-btn').click();

    await tester.step('game-started', {
        description: 'Game Board Started',
        verifications: [
            {
                spec: 'Board container should be visible',
                check: async () => await expect(page.locator('.board-container')).toBeVisible()
            },
            {
                spec: 'Board orientation should be 90°',
                check: async () => {
                    // matrix(0, 1, -1, 0, 0, 0) corresponds to 90deg, but 0 might be represented as very small number
                    await expect(page.locator('.board-container')).toHaveCSS('transform', /matrix\(.*, 1, -1, .*, 0, 0\)/);
                }
            },
            {
                spec: 'Should have 11 header cells (5 cols + 5 rows + 1 spacer)',
                check: async () => await expect(page.locator('.header-cell')).toHaveCount(11)
            },
            {
                spec: 'Should have 25 empty grid cells',
                check: async () => await expect(page.locator('.cell')).toHaveCount(25)
            },
            {
                spec: 'Headers should have population badges with counts',
                check: async () => {
                    await expect(page.locator('.population-badge')).toHaveCount(10);
                    // Check text content of first one
                    await expect(page.locator('.population-badge .pop-count').first()).toBeVisible();
                    await expect(page.locator('.population-badge .pop-count').first()).toHaveText(/[1-3]/);
                }
            },
            {
                spec: 'Headers should alternate ownership (Red/Yellow meeple color)',
                check: async () => {
                    const meeples = page.locator('.population-badge svg');
                    // First one (Red)
                    await expect(meeples.nth(0)).toHaveAttribute('fill', '#ff4d4d');
                    // Second one (Yellow)
                    await expect(meeples.nth(1)).toHaveAttribute('fill', '#ffd700');
                    // Third one (Red)
                    await expect(meeples.nth(2)).toHaveAttribute('fill', '#ff4d4d');
                }
            }
        ]
    });

    tester.generateDocs();
});
