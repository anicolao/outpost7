import { test, expect } from '@playwright/test';
import { TestStepHelper, waitForAnimations } from '../helpers/test-step-helper';

test.describe('Single Player Mode', () => {
    test('Start Solo Game and Verify AI Response', async ({ page }, testInfo) => {
        const helper = new TestStepHelper(page, testInfo);
        helper.setMetadata('Single Player Mode', 'Verify starting a solo game and AI Opponent response');

        // 1. Setup Phase: Start Solo
        await helper.step('001-start-solo', {
            description: 'Add 1 Player and Click Start Solo',
            verifications: [
                {
                    spec: 'Start Game with 1 Player',
                    check: async () => {
                        await page.goto('/?seed=e2e_test_solo'); // Use simple seed
                        await page.waitForLoadState('networkidle');
                        await expect(page.locator('.lobby-container')).toBeVisible();

                        // Add Red Player on Bottom
                        await page.locator('.bottom .add-btn').click();
                        await expect(page.locator('.color-picker')).toBeVisible();
                        await page.locator('.color-picker button[title="red"]').click();

                        // Wait for player to be added
                        await expect(page.locator('.bottom .player-token')).toBeVisible();

                        // Verify Button Text
                        await expect(page.locator('.start-label')).toHaveText('START SOLO');

                        // Click Start
                        await page.locator('.play-btn').click();

                        // Wait for Board
                        await expect(page.locator('.board-container')).toBeVisible();
                    }
                },
                {
                    spec: 'Verify AI Player Added',
                    check: async () => {
                        await page.evaluate(() => {
                            // @ts-ignore
                            const players = window.store.getState().game.players;
                            if (players.length !== 2) throw new Error('Expected 2 players');
                            const ai = players.find(p => p.type === 'ai');
                            if (!ai) throw new Error('No AI player found');
                            if (ai.color !== 'yellow') throw new Error('AI should be yellow');
                            if (ai.edge !== 'top') throw new Error('AI should be top (opposite bottom)');
                        });
                    }
                }
            ]
        });

        // 2. Play Human Move
        await helper.step('002-human-move', {
            description: 'Human (Red) plays a move',
            verifications: [
                {
                    spec: 'Play Red Card',
                    check: async () => {
                        // Ensure it's Red's turn
                        await expect(page.locator('.turn-indicator')).toHaveText(/RED TURN/i);

                        // Select Cards (Scripted for speed/stability)
                        await page.evaluate(() => {
                            // @ts-ignore
                            const store = window.store;
                            const hand = store.getState().game.hands.red;
                            if (hand.length < 2) throw new Error('Not enough cards');

                            // Just pick first two valid
                            const playCard = hand[0];
                            const payCard = hand[1];

                            store.dispatch({
                                type: 'SELECTION_UPDATE', // Won't work directly, need to set peerSelections in component?
                                // Actually, for local player, we just click UI or dispatch selection update locally if we simulated clicks.
                                // BUT wait, Board.svelte handles "handleCellClick" using "peerSelections".
                                // For local play (no peer), we need to see how selections work.
                                // Ah, Single Player uses the same Board logic?
                                // Board.svelte logic:
                                // "handleData" updates "peerSelections".
                                // BUT for local interactions, we usually need to set selection via UI or mock it.

                                // Actually, let's just use the `playCard` action directly to simulate the move execution 
                                // AND update the UI state to look like we selected it, OR just invoke the reducer directly.
                                // Invoking reducer is safer for E2E logic stability, but less "End-to-End".
                                // Given we want to test AI response, triggering via reducer is fine.

                                // Actually, let's try to simulate UI clicks if possible.
                                // Bottom player (Red) -> Face Down Card should appear if selected?
                                // But selection logic is usually handled by `HandApp` which is in a popup.
                                // In Single Player, do we have a HandApp?
                                // The QR code is shown. So yes, we'd need to connect a client.

                                // WAIT. Single Player mode implies I can play on the main screen?
                                // The prompt says "if a player joins the table...".
                                // It implies the main screen is the table.
                                // Players still connect via QR codes?
                                // "Make the setup so that if a player joins the table they can immediately start..."
                                // Usually means 1 phone connected, then start.
                                // So I still need to connect a client to play as Red? 
                                // YES.
                                // Checks:
                                // "QR Zones & Face Down Cards" section in Board.svelte
                            });
                        });

                        // Since we didn't connect a real client, we can't easily "play" via UI without opening a popup.
                        // For this test, let's just cheat and dispatch the move directly to the store to allow the game to progress 
                        // and see if the AI responds.
                        await page.evaluate(() => {
                            // @ts-ignore
                            const store = window.store;
                            const hand = store.getState().game.hands.red;
                            // Find valid pair
                            let playCard, payCard;
                            for (let i = 0; i < hand.length; i++) {
                                for (let j = 0; j < hand.length; j++) {
                                    if (i === j) continue;
                                    if (hand[j].cost >= hand[i].cost) {
                                        playCard = hand[i];
                                        payCard = hand[j];
                                        break;
                                    }
                                }
                                if (playCard) break;
                            }
                            if (!playCard || !payCard) throw new Error("No valid move in hand");

                            store.dispatch({
                                type: 'game/playCard',
                                payload: {
                                    color: 'red',
                                    playCardId: playCard.id,
                                    payCardId: payCard.id,
                                    row: 2,
                                    col: 2,
                                    settings: { CUBES_PER_PLAY: 1, CUBES_PER_COLOR_MATCH: 1, CUBES_PER_OVERPAYMENT: 1 }
                                }
                            });

                            // Auto-resolve any bonuses that triggered
                            let safety = 0;
                            while (store.getState().game.pendingBonuses.length > 0 && safety < 10) {
                                safety++;
                                const bonuses = store.getState().game.pendingBonuses;
                                bonuses.forEach(b => {
                                    store.dispatch({ type: 'game/resolveBonus', payload: { bonusId: b.id } });
                                });
                            }
                        });
                    }
                }
            ]
        });

        // 3. Verify AI Response
        await helper.step('003-verify-ai-response', {
            description: 'Wait for AI (Yellow) to play',
            verifications: [
                {
                    spec: 'Wait for Turn Change or Move',
                    check: async () => {
                        // Wait for turn count to increase (Red played (1) -> Yellow Played (2) -> Red's Turn (3))
                        // Or at least Red -> Yellow (2) -> ...
                        // If AI plays, turn should eventually go back to Red (3) OR Yellow plays something.
                        // AI has a 1s delay.

                        await expect.poll(async () => {
                            return page.evaluate(() => {
                                // @ts-ignore
                                return window.store.getState().game.turnCount;
                            });
                        }, { timeout: 5000 }).toBeGreaterThan(1);

                        // Check logs or state to see if Yellow played
                        await expect.poll(async () => {
                            return page.evaluate(() => {
                                // @ts-ignore
                                const grid = window.store.getState().game.grid;
                                // Check if any cell is owned by yellow
                                return grid.flat().some((c: any) => c && c.owner === 'yellow');
                            });
                        }, { timeout: 5000 }).toBe(true);
                    }
                }
            ]
        });

        helper.generateDocs();
    });
});
