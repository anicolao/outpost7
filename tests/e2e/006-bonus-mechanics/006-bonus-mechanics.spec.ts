import { test, expect } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';

test('Bonus Mechanics Flow', async ({ page: boardPage, context }, testInfo) => {
    const tester = new TestStepHelper(boardPage, testInfo);
    tester.setMetadata(
        'Bonus Mechanics',
        '**As a** player, **I want** to execute bonuses (Add Population) when triggered.'
    );

    // 1. Load Board with Seed (Red gets card_38 with ADD_POPULATION) and FIXED Host ID
    const HOST_ID = 'e2e_host';
    await boardPage.goto(`/?seed=seed_0&hostId=${HOST_ID}`); // Note: params might need encoding if complex, but simple strings are fine

    // 1b. Lobby Setup (Required to reach Board)
    await expect(boardPage.locator('.lobby-container')).toBeVisible();

    // Add Red
    await boardPage.locator('.edge-control.bottom .add-btn').click();
    await boardPage.locator('.edge-control.bottom .color-btn[title="red"]').click();

    // Add Yellow
    await boardPage.locator('.edge-control.top .add-btn').click();
    await boardPage.locator('.edge-control.top .color-btn[title="yellow"]').click();

    // Start Game
    await expect(boardPage.locator('.play-btn')).toBeVisible();
    await boardPage.locator('.play-btn').click();

    await tester.step('board-loaded', {
        description: 'Review: Board Loaded',
        verifications: [
            { spec: 'Board visible', check: async () => await expect(boardPage.locator('.board-container')).toBeVisible() }
        ]
    });

    // 2. Load Player Hand (Red) in New Page
    const playerPage = await context.newPage();

    // Pipe console logs
    playerPage.on('console', msg => console.log(`[PlayerPage] ${msg.text()}`));

    await playerPage.goto(`/#/hand?host=${HOST_ID}&color=red`);

    // Wait for connection
    await expect(playerPage.locator('text=Connected')).toBeVisible();

    // Verify Red has card_38
    await expect(playerPage.locator('[data-card-id="card_38"]')).toBeVisible();

    // 2b. Discard Phase (Must get under Cost 12)
    // Current Hand: 38(3), 41(4), 18(3), 50(6), 17(6). Total 22. Target 12.
    // We keep 38 and 41 for the play. (Total 7).
    // Discard 50(6), 17(6). (Total discarded 12. Remaining 10. Valid).
    await playerPage.locator('[data-card-id="card_50"]').click();
    await playerPage.locator('[data-card-id="card_17"]').click();

    // Verify Discard Selection
    await expect(playerPage.locator('[data-card-id="card_50"] .selected-overlay.discard')).toBeVisible();

    // Confirm Discard
    await playerPage.locator('.discard-btn').click();

    // Wait for cards to disappear
    await expect(playerPage.locator('[data-card-id="card_50"]')).not.toBeVisible();


    // 3. Play Card_38 (Cost 3)
    // Tap to Select Play
    await playerPage.locator('[data-card-id="card_38"]').click();

    // Verify Selection Mark (Play)
    await expect(playerPage.locator('[data-card-id="card_38"] .selected-overlay.play')).toBeVisible();

    // 4. Select Pay Card (Cost > 3). Hand logic requires Payer >= Play logic.
    // We use card_41 (Cost 4, Purple).
    // Red Plays card_38 (Cost 3, Purple).
    // Matches Color (Purple) + Overpay (1). -> Guaranteed Cubes.
    await playerPage.locator('[data-card-id="card_41"]').click();

    // Verify Pay Overlay
    await expect(playerPage.locator('[data-card-id="card_41"] .selected-overlay.pay')).toBeVisible();

    // 5. Board: Verify Peer Selection (Face Down Card appears)
    await expect(boardPage.locator('.face-down-card.bottom')).toBeVisible();

    // 6. Board: Place Card
    // Click cell (2, 2) - Center.
    await boardPage.locator('[data-cell-id="2-2"]').click();

    // 7. Verify Bonus Phase
    // card_38 has ADD_POPULATION on Cube 1.
    // With correct payment, we place at least 1 cube.
    // So Bonus Phase MUST trigger.
    await tester.step('bonus-triggered', {
        description: 'Bonus Phase Active',
        verifications: [
            { spec: 'Turn indicator says BONUS ACTIONS', check: async () => await expect(boardPage.locator('.turn-indicator')).toHaveText('BONUS ACTIONS') },
            { spec: 'Interactive Bonus Cube Visible', check: async () => await expect(boardPage.locator('.player-cube.interactive')).toBeVisible() }
        ]
    });

    // 8. Resolve Bonus
    // Click Interactive Cube
    await boardPage.locator('.player-cube.interactive').first().click();

    // Wait for animation
    await new Promise(r => setTimeout(r, 600));

    // 9. Verify Turn End (Red -> Yellow)
    await tester.step('turn-ended', {
        description: 'Turn Completed',
        verifications: [
            { spec: 'Turn indicator says YELLOW TURN', check: async () => await expect(boardPage.locator('.turn-indicator')).toContainText('YELLOW TURN') },
            { spec: 'Bonus Phase Ended', check: async () => await expect(boardPage.locator('.turn-indicator')).not.toContainText('BONUS ACTIONS') }
        ]
    });

    tester.generateDocs();
});
