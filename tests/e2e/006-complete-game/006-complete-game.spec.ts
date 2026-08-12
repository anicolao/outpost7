import { test, expect } from '@playwright/test';
import { TestStepHelper, waitForAnimations } from '../helpers/test-step-helper';
import { playCard, salvage } from '../../../src/lib/gameSlice';

test('Complete Game Walkthrough', async ({ page }, testInfo) => {
    const tester = new TestStepHelper(page, testInfo);

    tester.setMetadata(
        'Complete Game Loop',
        '**As a** player, **I want** to play a complete game until a winner is declared, **so that** I can experience the full game flow.'
    );

    // 1. Initial Load & Setup
    // Use fixed seed for deterministic behavior
    await page.goto('/?seed=complete-game-test&gameId=e2e_complete_game');

    await tester.step('01-initial-state', {
        description: 'Game Loaded',
        verifications: [
            { spec: 'Lobby Visible', check: async () => await expect(page.locator('.lobby-container')).toBeVisible() }
        ]
    });

    // 2. Add Players
    await page.locator('.edge-control.bottom .add-btn').click();
    await page.locator('.edge-control.bottom .color-btn[title="red"]').click();
    await page.locator('.edge-control.top .add-btn').click();
    await page.locator('.edge-control.top .color-btn[title="yellow"]').click();

    await tester.step('02b-players-joined', {
        description: 'Players Joined',
        verifications: [
            { spec: 'Start Button Visible', check: async () => await expect(page.locator('.play-btn')).toBeVisible() },
            {
                spec: 'The lobby fills the viewport',
                check: async () => expect(await page.locator('.lobby-container').evaluate((lobby) => {
                    const bounds = lobby.getBoundingClientRect();
                    const initialScrollLeft = lobby.scrollLeft;
                    lobby.scrollLeft = 16;
                    const scrollLeftAfterAttempt = lobby.scrollLeft;
                    lobby.scrollLeft = initialScrollLeft;
                    return {
                        x: bounds.x,
                        y: bounds.y,
                        width: bounds.width,
                        height: bounds.height,
                        viewportWidth: window.innerWidth,
                        viewportHeight: window.innerHeight,
                        initialScrollLeft,
                        scrollLeftAfterAttempt,
                        overflowX: getComputedStyle(lobby).overflowX,
                    };
                })).toEqual({
                    x: 0,
                    y: 0,
                    width: 1280,
                    height: 720,
                    viewportWidth: 1280,
                    viewportHeight: 720,
                    initialScrollLeft: 0,
                    scrollLeftAfterAttempt: 0,
                    overflowX: 'clip',
                }),
            },
        ]
    });

    // 3. Settings (2x2)
    await page.click('button[aria-label="Settings"]');
    await page.getByRole('button', { name: 'Setup rules' }).click();
    await page.locator('[data-setting-key="GRID_ROWS"] .value').selectOption('2');
    await page.locator('[data-setting-key="GRID_COLS"] .value').selectOption('2');
    await page.locator('.modal .content').evaluate((content) => content.scrollTo(0, 0));

    await tester.step('02-settings-changed', {
        description: 'Settings Updated to 2x2 Grid',
        verifications: [
            { spec: 'Grid Rows is 2', check: async () => await expect(page.locator('[data-setting-key="GRID_ROWS"] .value')).toHaveValue('2') }
        ]
    });
    await page.click('.close-btn');
    await expect(page.locator('.backdrop')).toHaveCount(0);

    // 4. Start Game
    await page.click('.play-btn');

    await tester.step('03-game-started', {
        description: 'Game Started with 2x2 Grid',
        verifications: [
            { spec: 'Board Visible', check: async () => await expect(page.locator('.board-container')).toBeVisible() },
            { spec: 'Grid has 4 cells', check: async () => await expect(page.locator('.cell')).toHaveCount(4) }
        ]
    });

    // 5. Play Moves via Store Dispatch
    const playMove = async (color: 'red' | 'yellow', row: number, col: number) => {
        // Read State to find cards
        const state = await page.evaluate(() => (window as any).store.getState());
        const hand = state.game.hands[color];

        // Find a playable card (low cost) and a pay card (high cost)
        const sortedHand = [...hand].sort((a: any, b: any) => a.cost - b.cost);
        const playCardObj = sortedHand[0];
        const payCardObj = sortedHand[sortedHand.length - 1];

        const playId = playCardObj.id;
        const payId = payCardObj.id;

        if (playId === payId) throw new Error("Hand too small to play");

        const action = playCard({
            color,
            playCardId: playId,
            payCardId: payId,
            row,
            col,
        });

        // Dispatch
        // We must serialize action if needed? No, playCard returns JSON serializable object.
        await page.evaluate((action) => (window as any).store.dispatch(action), action);

        // Wait for UI to update (Svelte render)
        const cellSelector = `[data-cell-id="${row}-${col}"] .played-card`;
        await expect(page.locator(cellSelector)).toBeVisible();

        // Wait for image to load to prevent snapshot race conditions
        const img = page.locator(`${cellSelector} img.card-bg`);
        await expect(img).toBeVisible();
        await expect(img).toHaveJSProperty('complete', true);
        await expect(img).not.toHaveJSProperty('naturalWidth', 0);

        await waitForAnimations(page);
    };

    await playMove('red', 0, 0);
    await tester.step('04-red-played', { description: 'Red Played 0,0', verifications: [], skipScreenshot: true });

    await playMove('yellow', 0, 1);
    await playMove('red', 1, 0);
    await playMove('yellow', 1, 1);

    await tester.step('05-grid-full', {
        description: 'Grid Filled',
        verifications: [
            { spec: '4 played cards', check: async () => await expect(page.locator('.played-card')).toHaveCount(4) }
        ],
        skipScreenshot: true
    });

    // 6. Force Game End by Salvaging loop
    const salvageLoop = async () => {
        for (let i = 0; i < 20; i++) {
            const state = await page.evaluate(() => (window as any).store.getState().game);
            if (state.phase === 'game_over') break;

            const color = state.currentTurn;
            const hand = state.hands[color];

            // If hand >= 7, we can't normally salvage, but if game is stuck?
            // Actually logic says: if you can't play and can't salvage, pass.
            // If grid is full, we can't play.
            // If hand >= 7, can we salvage? NO.
            // Then hasValidMoves should be false. And turn should auto-pass.
            // BUT endTurn is only triggered on action.
            // If we are stuck, we need to interact to trigger endTurn?
            // No, endTurn triggers at end of previous action.
            // So if we just played the last card filling the grid (Yellow at 1,1).
            // The logic in gameSlice `playCard` calls `endTurn`.
            // `endTurn` checks next player (Red).
            // Red: grid full -> no play.
            // Red: hand < 7? If yes, Red CAN Salvage. Turn passes to Red.
            // THEN Red must salvage.
            // If Red keeps salvaging until hand=7.
            // Then Red plays Salvage action. `salvage` creates action.
            // `salvage` reducer calls `endTurn`.
            // `endTurn` checks next player (Yellow).
            // Yellow: grid full -> no play.
            // Yellow: hand < 7? Yes -> Yellow turn.
            // ...
            // Eventually, Hands Full.
            // Red hand=7. Cannot salvage.
            // Yellow hand=7. Cannot salvage.

            // So we just need to salvage if hand < 7.
            if (hand.length < 7) {
                const offer = state.offer;
                if (offer.length > 0) {
                    const pick = offer[0];
                    const action = salvage({ color, cardIds: [pick.id] });
                    await page.evaluate((action) => (window as any).store.dispatch(action), action);
                    await waitForAnimations(page);
                }
            } else {
                throw new Error(`${color} has a full hand but the game did not finish the player`);
            }
        }
    };

    await salvageLoop();

    await tester.step('06-game-over', {
        description: 'Game Over Screen',
        verifications: [
            { spec: 'Game Over visible', check: async () => await expect(page.locator('.game-over-modal')).toBeVisible() }
        ],
        skipScreenshot: true
    });

    tester.generateDocs();
});
