import { test, expect } from '@playwright/test';
import { TestStepHelper } from './helpers/test-step-helper';

test('Bonus Mechanics Flow', async ({ page }, testInfo) => {
    const tester = new TestStepHelper(page, testInfo);

    tester.setMetadata(
        'Bonus Mechanics',
        '**As a** player, **I want** to execute bonuses when triggered, **so that** I can gain advantages and complete my turn.'
    );

    // 1. Load Lobby
    await page.goto('/');
    await tester.step('lobby-load', {
        description: 'Lobby Loaded',
        verifications: [
            { spec: 'Lobby is visible', check: async () => await expect(page.locator('.lobby-container')).toBeVisible() }
        ]
    });

    // 2. Setup Players
    // Add Red (Bottom Edge)
    await page.locator('.edge-control.bottom .add-btn').click();
    // Helper to wait for animation if needed, or just click color
    // In Lobby svelte, clicking add sets 'selectingStore = edge', showing color picker.
    await expect(page.locator('.edge-control.bottom .color-picker')).toBeVisible();
    await page.locator('.edge-control.bottom .color-btn[title="red"]').click();

    // Verification: Player joined
    await expect(page.locator('.edge-control.bottom .player-token')).toBeVisible();

    // Add Yellow (Top Edge)
    await page.locator('.edge-control.top .add-btn').click();
    await expect(page.locator('.edge-control.top .color-picker')).toBeVisible();
    await page.locator('.edge-control.top .color-btn[title="yellow"]').click();

    await tester.step('players-joined', {
        description: 'Players Joined',
        verifications: [
            { spec: 'Start button appears', check: async () => await expect(page.locator('.play-btn')).toBeVisible() }
        ]
    });

    // 3. Start Game
    await page.locator('.play-btn').click();

    // 4. Verify Board
    await tester.step('game-start', {
        description: 'Game Started',
        verifications: [
            { spec: 'Game board is visible', check: async () => await expect(page.locator('.board-container')).toBeVisible() },
            { spec: 'Turn indicator visible', check: async () => await expect(page.locator('.turn-indicator')).toBeVisible() }
        ]
    });

    // 5. Generate Docs
    tester.generateDocs();
});
