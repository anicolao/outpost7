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
    await page.goto('/');

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
                check: async () => await expect(page.locator('.edge-control.bottom .color-picker')).toBeVisible()
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
                check: async () => await expect(page.locator('.edge-control.top .color-picker')).toBeVisible()
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
                spec: 'Orientation should be 0°',
                check: async () => await expect(page.getByText('Orientation: 0°')).toBeVisible()
            }
        ]
    });

    tester.generateDocs();
});
