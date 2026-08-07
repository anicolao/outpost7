import { test, expect, type Page } from '@playwright/test';
import { TestStepHelper, waitForAnimations } from '../helpers/test-step-helper';

test.describe('Ownership Evaluation', () => {
    test('Verify Ownership Flip (Row 2, Col 1)', async ({ page }) => {
        // Set E2E Flag
        await page.addInitScript(() => {
            // @ts-ignore
            window.E2E_TEST = true;
        });



        const helper = new TestStepHelper(page, test.info());
        helper.setMetadata('Ownership Flip', 'Verify flipping ownership of Row 2 and Col 1 from Yellow to Red');

        // 1. Host - Start Game
        await helper.step('001-setup-host', {
            description: 'Start Game with Red and Yellow',
            verifications: [
                {
                    spec: 'Add Players and Start',
                    check: async () => {
                        await page.goto('/?seed=e2e_flip&gameId=e2e_host_flip');
                        await page.locator('.bottom .add-btn').click({ force: true });
                        await page.locator('.color-picker button[title="red"]').click({ force: true });
                        await page.locator('.top .add-btn').click({ force: true });
                        await page.locator('.color-picker button[title="yellow"]').click({ force: true });
                        await page.locator('.play-btn').click({ force: true });
                        await expect(page.locator('.board-container')).toBeVisible();
                    }
                }
            ]
        });

        // 2. Script: Yellow Claims Row 2 and Col 1
        await helper.step('002-yellow-claims', {
            description: 'Script Yellow to claim Row 2 and Column 1',
            verifications: [
                {
                    spec: 'Execute Yellow Moves',
                    check: async () => {
                        await page.evaluate(async () => {
                            // @ts-ignore
                            const store = window.store;
                            // @ts-ignore
                            const settings = {
                                CUBES_PER_PLAY: 0,
                                CUBES_PER_COLOR_MATCH: 1,
                                CUBES_PER_OVERPAYMENT: 1,
                                SALVAGE_MAX_COST: 12,
                                GRID_ROWS: 5,
                                GRID_COLS: 5,
                                HAND_LIMIT: 100 // Set high to avoid discard phase
                            };

                            const playYellowMove = (r: number, c: number) => {
                                const state = store.getState().game;
                                const hand = state.hands.yellow;
                                // Strategy: Find pair with MINIMUM cubes > 0.
                                let bestPair = null;
                                let minCubes = 100;

                                for (let i = 0; i < hand.length; i++) {
                                    for (let j = 0; j < hand.length; j++) {
                                        if (i === j) continue;
                                        if (hand[j].cost >= hand[i].cost) {
                                            // Calculate cubes
                                            const colorMatch = hand[i].color === hand[j].color ? 1 : 0;
                                            const overpay = Math.max(0, hand[j].cost - hand[i].cost);
                                            const cubes = settings.CUBES_PER_PLAY + colorMatch + (overpay * settings.CUBES_PER_OVERPAYMENT);

                                            if (cubes > 0 && cubes < minCubes) {
                                                minCubes = cubes;
                                                bestPair = { playIndex: i, payIndex: j };
                                            }
                                        }
                                    }
                                }

                                if (bestPair) {
                                    const playCard = hand[bestPair.playIndex];
                                    const payCard = hand[bestPair.payIndex];
                                    store.dispatch({
                                        type: 'game/playCard',
                                        payload: {
                                            color: 'yellow',
                                            playCardId: playCard.id,
                                            payCardId: payCard.id,
                                            row: r,
                                            col: c,
                                            settings
                                        }
                                    });
                                }
                            };

                            // Ensure Yellow has cards (should have 5)
                            // Play at (2, 2) -> Row 2
                            playYellowMove(2, 2);

                            // Deal more cards to ensure hand
                            store.dispatch({ type: 'game/dealCards', payload: { count: 2, to: 'yellow' } });

                            // Play at (0, 1) -> Col 1
                            playYellowMove(0, 1);

                            // Resolve any bonuses that might have triggered
                            // Loop until no pending bonuses
                            let safety = 0;
                            while (store.getState().game.pendingBonuses.length > 0 && safety < 10) {
                                const bonusId = store.getState().game.pendingBonuses[0].id;
                                store.dispatch({ type: 'game/resolveBonus', payload: { bonusId } });
                                safety++;
                            }

                            // Fix Turn Parity if needed (We need RED turn)
                            if (store.getState().game.currentTurn === 'yellow') {
                                playYellowMove(4, 4); // Dummy move
                                // Resolve bonuses again if triggered
                                while (store.getState().game.pendingBonuses.length > 0) {
                                    const bonusId = store.getState().game.pendingBonuses[0].id;
                                    store.dispatch({ type: 'game/resolveBonus', payload: { bonusId } });
                                }
                            }
                        });

                        // Verify Yellow claimed them
                        await waitForAnimations(page);

                        // Row 2 Header (Index 2)
                        const rowHeader = page.locator('.header-cell.row-header').nth(2).locator('svg');
                        await expect(rowHeader).toHaveAttribute('fill', '#ffd700'); // Yellow

                        // Col 1 Header (Index 1)
                        const colHeader = page.locator('.header-cell.top-header').nth(1).locator('svg');
                        await expect(colHeader).toHaveAttribute('fill', '#ffd700');
                    }
                }
            ]
        });

        // 3. Connect Red Client
        let redPage: Page = null as any;
        await helper.step('003-connect-red', {
            description: 'Connect Red Player',
            verifications: [
                {
                    spec: 'Open Red Client',
                    check: async () => {
                        const qrItem = page.locator('.qr-zone.bottom .qr-item');
                        // It might be hidden if Red's turn passed? 
                        // No, QR should be visible if not connected.
                        // But wait, if Red "missed" turns? 
                        // Connection is independent of turn.
                        await qrItem.waitFor({ state: 'visible' });
                        const [popup] = await Promise.all([
                            page.waitForEvent('popup'),
                            qrItem.click({ force: true })
                        ]);
                        await popup.waitForLoadState();
                        redPage = popup;
                        await expect(redPage.locator('.status')).toHaveText('Connected');
                    }
                }
            ]
        });

        // 4. Script: Ensure Red Strong Hand
        await helper.step('004-fix-red-hand', {
            description: 'Ensure Red has a play generating >= 2 cubes',
            verifications: [
                {
                    spec: 'Cycle cards until strong pair found',
                    check: async () => {
                        await page.evaluate(async () => {
                            // @ts-ignore
                            const store = window.store;
                            // @ts-ignore
                            const settings = { CUBES_PER_COLOR_MATCH: 1, CUBES_PER_OVERPAYMENT: 1, CUBES_PER_PLAY: 0 };

                            const findStrongPair = () => {
                                const hand = store.getState().game.hands.red;
                                for (let i = 0; i < hand.length; i++) {
                                    for (let j = 0; j < hand.length; j++) {
                                        if (i === j) continue;
                                        if (hand[j].cost >= hand[i].cost) {
                                            const colorMatch = hand[i].color === hand[j].color ? 1 : 0;
                                            const overpay = Math.max(0, hand[j].cost - hand[i].cost);
                                            const cubes = settings.CUBES_PER_PLAY + colorMatch + (overpay * settings.CUBES_PER_OVERPAYMENT);

                                            // We need 3 cubes to beat Yellow (who might have 2).
                                            if (cubes >= 3) return true;
                                        }
                                    }
                                }
                                return false;
                            };

                            let attempts = 0;
                            while (!findStrongPair() && attempts < 20) {
                                // Discard first card to make space/cycle
                                const hand = store.getState().game.hands.red;
                                if (hand.length > 0) {
                                    store.dispatch({
                                        type: 'game/playerDiscard',
                                        payload: { color: 'red', cardIds: [hand[0].id] }
                                    });
                                }
                                // Deal 1 new card
                                store.dispatch({ type: 'game/dealCards', payload: { count: 1, to: 'red' } });
                                attempts++;
                            }

                            if (attempts >= 20) throw new Error('Could not find strong pair for Red');
                        });

                        // Wait for client to sync
                        await waitForAnimations(redPage);
                    }
                }
            ]
        });

        // 5. Red Plays Strong Move at (2, 1)
        await helper.step('005-red-plays', {
            description: 'Red plays at (2, 1) intersection',
            verifications: [
                {
                    spec: 'Select matching/overpay pair',
                    check: async () => {
                        // Get indices from Host
                        const indices = await page.evaluate(() => {
                            // @ts-ignore
                            const store = window.store;
                            // @ts-ignore
                            const settings = { CUBES_PER_COLOR_MATCH: 1, CUBES_PER_OVERPAYMENT: 1, CUBES_PER_PLAY: 0 };
                            const hand = store.getState().game.hands.red;

                            for (let i = 0; i < hand.length; i++) {
                                for (let j = 0; j < hand.length; j++) {
                                    if (i === j) continue;
                                    if (hand[j].cost >= hand[i].cost) {
                                        const colorMatch = hand[i].color === hand[j].color ? 1 : 0;
                                        const overpay = Math.max(0, hand[j].cost - hand[i].cost);
                                        const cubes = settings.CUBES_PER_PLAY + colorMatch + (overpay * settings.CUBES_PER_OVERPAYMENT);
                                        if (cubes >= 2) return { playIndex: i, payIndex: j };
                                    }
                                }
                            }
                            return null;
                        });

                        if (!indices) throw new Error('Indices not found (should have been fixed)');

                        const cards = redPage.locator('.card-wrapper');

                        // Discard phase should be avoided by setting HAND_LIMIT high in step 1.
                        // If it still appears, it means the hand limit was not applied or there's another issue.
                        if (await redPage.locator('.alert-banner').isVisible()) {
                            throw new Error('Discard phase unexpectedly appeared. Check HAND_LIMIT setting.');
                        }

                        await cards.nth(indices.playIndex).click({ force: true });
                        await expect(cards.nth(indices.playIndex).locator('.selected-overlay.play')).toBeVisible();

                        await cards.nth(indices.payIndex).click({ force: true });
                        await expect(cards.nth(indices.payIndex).locator('.selected-overlay.pay')).toBeVisible();
                    }
                }
            ]
        });

        // 6. Host Executes Move at (2, 1)
        await helper.step('006-execute-flip', {
            description: 'Execute move at (2, 1)',
            verifications: [
                {
                    spec: 'Click cell (2, 1)',
                    check: async () => {
                        await expect(page.locator('.face-down-card.bottom')).toBeVisible();

                        // Ensure it's Red's Turn
                        await expect(page.locator('.turn-indicator')).toHaveText('RED TURN');

                        await page.locator('[data-cell-id="2-1"]').click({ force: true });
                        await expect(page.locator('[data-cell-id="2-1"] .card-bg')).toBeVisible();

                        // Resolve Red Bonuses if triggered
                        await page.evaluate(async () => {
                            // @ts-ignore
                            const store = window.store;
                            let s = 0;
                            while (store.getState().game.pendingBonuses.length > 0 && s < 10) {
                                const bonusId = store.getState().game.pendingBonuses[0].id;
                                store.dispatch({ type: 'game/resolveBonus', payload: { bonusId } });
                                s++;
                            }
                        });
                    }
                }
            ]
        });

        // 7. Verify Flip
        await helper.step('007-verify-flip', {
            description: 'Row 2 and Col 1 should be Red',
            verifications: [
                {
                    spec: 'Headers are Red',
                    check: async () => {
                        // Wait for processing
                        await waitForAnimations(page);

                        // Row 2
                        const rowHeader = page.locator('.header-cell.row-header').nth(2).locator('svg');
                        await expect(rowHeader).toHaveAttribute('fill', '#ff4d4d');

                        // Col 1
                        const colHeader = page.locator('.header-cell.top-header').nth(1).locator('svg');
                        await expect(colHeader).toHaveAttribute('fill', '#ff4d4d');
                    }
                }
            ]
        });

        helper.generateDocs();
    });
});
