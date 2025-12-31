import { test, expect } from '@playwright/test';
import { TestStepHelper, waitForAnimations } from '../helpers/test-step-helper';
import { computeAIMove } from '../../../src/lib/ai/basicAI';
import type { AIMove } from '../../../src/lib/ai/basicAI';
import { playCard, salvage } from '../../../src/lib/gameSlice';

test('AI vs AI Complete Game', async ({ page }, testInfo) => {
    const tester = new TestStepHelper(page, testInfo);

    tester.setMetadata(
        'AI vs AI Complete Game',
        '**As a** developer, **I want** to see two AI players complete a full game, **so that** I can verify the AI logic works correctly.'
    );

    // 1. Initial Load & Setup
    await page.goto('/?seed=ai-vs-ai-test');

    await tester.step('01-initial-state', {
        description: 'Game Loaded',
        verifications: [
            { spec: 'Lobby Visible', check: async () => await expect(page.locator('.lobby-container')).toBeVisible() }
        ]
    });

    // 2. Settings (3x3 for reasonable game length)
    await page.click('button[aria-label="Settings"]');
    const rowsMinus = page.locator('.setting-item:has-text("Grid Rows") button:has-text("-")');
    await rowsMinus.click(); await rowsMinus.click(); // 5->3
    const colsMinus = page.locator('.setting-item:has-text("Grid Columns") button:has-text("-")');
    await colsMinus.click(); await colsMinus.click(); // 5->3

    await tester.step('02-settings-changed', {
        description: 'Settings Updated to 3x3 Grid',
        verifications: [
            { spec: 'Grid Rows is 3', check: async () => await expect(page.locator('.setting-item:has-text("Grid Rows") .value')).toHaveText('3') },
            { spec: 'Grid Cols is 3', check: async () => await expect(page.locator('.setting-item:has-text("Grid Columns") .value')).toHaveText('3') }
        ]
    });
    await page.click('.close-btn');

    // 3. Add Players
    await page.locator('.edge-control.bottom .add-btn').click();
    await page.locator('.edge-control.bottom .color-btn[title="red"]').click();
    await page.locator('.edge-control.top .add-btn').click();
    await page.locator('.edge-control.top .color-btn[title="yellow"]').click();

    await tester.step('03-players-joined', {
        description: 'Both AI Players Joined',
        verifications: [
            { spec: 'Start Button Visible', check: async () => await expect(page.locator('.play-btn')).toBeVisible() }
        ]
    });

    // 4. Start Game
    await page.click('.play-btn');

    await tester.step('04-game-started', {
        description: 'Game Started with 3x3 Grid',
        verifications: [
            { spec: 'Board Visible', check: async () => await expect(page.locator('.board-container')).toBeVisible() },
            { spec: 'Grid has 9 cells', check: async () => await expect(page.locator('.cell')).toHaveCount(9) }
        ]
    });

    const mockSettings = {
        GRID_ROWS: 3,
        GRID_COLS: 3,
        SALVAGE_MAX_COST: 12,
        CUBES_PER_COLOR_MATCH: 1,
        CUBES_PER_PLAY: 1,
        CUBES_PER_OVERPAYMENT: 1,
        STARTING_HAND_LIMIT_P1: 12,
        STARTING_HAND_LIMIT_P2: 16
    };

    // Helper to display AI hand both in console and as verification
    const showAIHand = async (color: 'red' | 'yellow', context: string) => {
        const state = await page.evaluate(() => (window as any).store.getState().game);
        const hand = state.hands[color];
        
        console.log(`\n=== ${color.toUpperCase()} AI Hand (${context}) ===`);
        hand.forEach((card: any) => {
            console.log(`  - ${card.color} ${card.cost} (id: ${card.id})`);
        });
        console.log('');
        
        return hand;
    };

    // Helper to capture hand state with screenshot
    const captureHandState = async (stepId: string, description: string, showRed: boolean = true, showYellow: boolean = true) => {
        const state = await page.evaluate(() => (window as any).store.getState().game);
        const redHand = state.hands.red;
        const yellowHand = state.hands.yellow;

        let handSummary: string[] = [];
        if (showRed) {
            handSummary.push(`Red Hand: ${redHand.map((c: any) => `${c.color[0].toUpperCase()}${c.cost}`).join(', ')}`);
        }
        if (showYellow) {
            handSummary.push(`Yellow Hand: ${yellowHand.map((c: any) => `${c.color[0].toUpperCase()}${c.cost}`).join(', ')}`);
        }

        await tester.step(stepId, {
            description: `${description}\n\n${handSummary.join(' | ')}`,
            verifications: [
                { spec: 'Board visible', check: async () => await expect(page.locator('.board-container')).toBeVisible() }
            ]
        });
    };

    // Helper to execute AI move
    const executeAIMove = async (stepPrefix: string, description: string, showHand: boolean = false) => {
        const state = await page.evaluate(() => (window as any).store.getState().game);
        
        if (state.phase === 'game_over') {
            return false; // Game ended
        }

        const currentPlayer = state.currentTurn;
        
        if (showHand) {
            await showAIHand(currentPlayer, description);
        }

        // Compute move using Node-side AI
        const aiDecision = computeAIMove(state);

        console.log(`${currentPlayer.toUpperCase()} AI Decision:`, aiDecision);

        if (aiDecision.type === 'REPAIR') {
            const action = playCard({
                color: currentPlayer,
                playCardId: aiDecision.playCardId,
                payCardId: aiDecision.discardCardId,
                row: aiDecision.row,
                col: aiDecision.col,
                settings: mockSettings
            });

            await page.evaluate((action) => (window as any).store.dispatch(action), action);

            // Wait for card to appear
            const cellSelector = `[data-cell-id="${aiDecision.row}-${aiDecision.col}"] .played-card`;
            await expect(page.locator(cellSelector)).toBeVisible();

            // Wait for image to load
            const img = page.locator(`${cellSelector} img.card-bg`);
            await expect(img).toBeVisible();
            await expect(img).toHaveJSProperty('complete', true);
            await expect(img).not.toHaveJSProperty('naturalWidth', 0);

            await waitForAnimations(page);
        } else if (aiDecision.type === 'SALVAGE') {
            const action = salvage({ 
                color: currentPlayer, 
                cardIds: aiDecision.cardIds 
            });

            await page.evaluate((action) => (window as any).store.dispatch(action), action);
            await waitForAnimations(page);
        } else if (aiDecision.type === 'PASS') {
            console.log(`${currentPlayer} AI passes (no valid moves)`);
            return false;
        }

        return true;
    };

    // Play the game loop
    let moveCount = 0;
    const maxMoves = 100; // Safety limit

    // Show initial hands
    await captureHandState('05-initial-hands', 'Initial Hands (Before First Move)', true, true);

    while (moveCount < maxMoves) {
        const state = await page.evaluate(() => (window as any).store.getState().game);
        
        if (state.phase === 'game_over') {
            break;
        }

        const currentPlayer = state.currentTurn;
        const showHandInConsole = (moveCount % 5 === 0);
        
        if (showHandInConsole) {
            await showAIHand(currentPlayer, `Move ${moveCount + 1}`);
        }

        const continued = await executeAIMove(
            `move-${moveCount}`,
            `Move ${moveCount + 1}`,
            false // Don't show hand in move execution
        );

        if (!continued) {
            // No more moves, check if game is over
            const newState = await page.evaluate(() => (window as any).store.getState().game);
            if (newState.phase !== 'game_over') {
                console.log('Both players passed but game not over. Breaking.');
                break;
            }
        }

        moveCount++;

        // Take a screenshot every 3 moves to document progress better
        if (moveCount > 0 && moveCount % 3 === 0) {
            const currentState = await page.evaluate(() => (window as any).store.getState().game);
            const player = currentState.currentTurn;
            await captureHandState(
                `progress-move-${moveCount}`, 
                `After ${moveCount} Moves - ${player.toUpperCase()}'s Turn`,
                true,
                true
            );
        }
    }

    // Show final hands before game over (only if game is not over yet)
    const finalState = await page.evaluate(() => (window as any).store.getState().game);
    if (finalState.phase !== 'game_over') {
        await captureHandState('final-hands', 'Final Hands (Game Complete)', true, true);
    }

    // Capture final state
    await tester.step('game-over', {
        description: 'Game Over Screen',
        verifications: [
            { spec: 'Game Over Modal Visible', check: async () => await expect(page.locator('.game-over-modal')).toBeVisible() },
            { spec: 'Winner Declared', check: async () => {
                const state = await page.evaluate(() => (window as any).store.getState().game);
                expect(state.winner).toBeTruthy();
                expect(['red', 'yellow', 'draw']).toContain(state.winner);
            }}
        ]
    });

    // Log final scores
    console.log('\n=== GAME OVER ===');
    console.log(`Winner: ${finalState.winner}`);
    console.log(`Red Score: ${finalState.scores.red}`);
    console.log(`Yellow Score: ${finalState.scores.yellow}`);
    console.log(`Total Moves: ${moveCount}`);

    tester.generateDocs();
});
