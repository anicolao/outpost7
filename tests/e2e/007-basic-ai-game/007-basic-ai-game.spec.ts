import { test, expect } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';
import { BasicAI } from '../../../src/lib/ai/BasicAI';
import type { GameState } from '../../../src/lib/types';

test('Basic AI vs Basic AI Complete Game', async ({ page }, testInfo) => {
    test.setTimeout(300000); // 5 minutes for full game simulation
    // 1. Setup
    const helper = new TestStepHelper(page, testInfo);
    helper.setMetadata('Basic AI Match', 'A complete game played between two Basic AIs (Red vs Yellow).');

    // Inject E2E flag and Helpers
    page.on('console', msg => console.log('BROWSER LOG:', msg.text()));

    await page.addInitScript(() => {
        // @ts-ignore
        window.E2E_TEST = true;
    });

    await helper.step('000-setup', {
        description: 'Initialize Game with AI Config',
        verifications: [
            {
                spec: 'Load Game with Fixed Seed',
                check: async () => {
                    await page.goto('/?seed=ai_battle_001&gameId=e2e_ai_battle');
                    await expect(page.locator('.lobby-container')).toBeVisible();
                }
            },
            {
                spec: 'Add Players and Start',
                check: async () => {
                    // This scenario intentionally gives every affordable pair a
                    // base cube. Configure the game itself so the AI and reducer
                    // use the same authoritative rule snapshot.
                    await page.locator('.settings-btn.top-left').click();
                    await page.locator('[data-setting-key="CUBES_PER_PLAY"] button', { hasText: '+' }).click();
                    await expect(page.locator('[data-setting-key="CUBES_PER_PLAY"] .value')).toHaveText('1');
                    await page.locator('.modal .close-btn').click();

                    // Add Red
                    await page.locator('.bottom .add-btn').click();
                    await page.locator('.color-picker button[title="red"]').click();

                    // Add Yellow
                    await page.locator('.top .add-btn').click();
                    await page.locator('.color-picker button[title="yellow"]').click();

                    // Start
                    await page.locator('.play-btn').click();
                    await expect(page.locator('.board-container')).toBeVisible();

                    // Verify Hand Display
                    await expect(page.locator('.e2e-hand-display')).toBeVisible();
                }
            }
        ]
    });

    // 2. Game Loop
    let gameActive = true;
    let turnCount = 1;
    let safeguard = 0; // Prevent infinite loops

    const aiSettings = await page.evaluate(() => {
        // @ts-ignore E2E store exposure
        return window.store.getState().game.settings;
    });
    const aiRed = new BasicAI('red', 'ai_battle_001', aiSettings);
    const aiYellow = new BasicAI('yellow', 'ai_battle_001', aiSettings);

    while (gameActive && safeguard < 300) {
        safeguard++;

        // Get Game State from Browser
        const gameStateString = await page.evaluate(() => {
            // @ts-ignore
            const state = window.store.getState().game;
            // Serialize what we need (just pass the object, Playwright handles JSON)
            return JSON.stringify(state);
        });

        const gameState: GameState = JSON.parse(gameStateString);

        if (gameState.phase === 'game_over') {
            gameActive = false;
            break;
        }

        const currentPlayer = gameState.currentTurn;
        const ai = currentPlayer === 'red' ? aiRed : aiYellow;
        const move = ai.computeMove(gameState);

        console.log(`[Turn ${turnCount}] ${currentPlayer} chose:`, move);

        // Step Description
        let desc = `Turn ${turnCount}: ${currentPlayer.toUpperCase()} - `;
        if (move.type === 'PASS') desc += 'PASS';
        else if (move.type === 'SALVAGE') desc += `SALVAGE (${move.cardIds.join(', ')})`;
        else if (move.type === 'RESOLVE_BONUS') desc += `BONUS (${move.bonusId})`;
        else desc += `REPAIR (Play ${move.playCardId} at ${move.row},${move.col})`;

        // Execute Move
        await helper.step(`turn-${String(turnCount).padStart(3, '0')}-${currentPlayer}`, {
            description: desc,
            verifications: [
                {
                    spec: `Execute ${move.type}`,
                    check: async () => {
                        const previousTurnCount = gameState.turnCount;
                        const previousBonusCount = gameState.pendingBonuses.length;

                        if (move.type === 'PASS') {
                            console.warn(`[Turn ${turnCount}] AI passed. Dispatching passTurn.`);
                            await page.evaluate((m) => {
                                // @ts-ignore
                                window.store.dispatch({
                                    type: 'game/passTurn',
                                    payload: { color: m.color }
                                });
                            }, { ...move, color: currentPlayer });

                        } else if (move.type === 'SALVAGE') {
                            await page.evaluate((m) => {
                                // @ts-ignore
                                window.store.dispatch({
                                    type: 'game/salvage',
                                    payload: { color: m.color, cardIds: m.cardIds }
                                });
                            }, { ...move, color: currentPlayer });
                        } else if (move.type === 'REPAIR') {
                            await page.evaluate((m) => {
                                // @ts-ignore
                                window.store.dispatch({
                                    type: 'game/playCard',
                                    // @ts-ignore
                                    payload: {
                                        color: m.color,
                                        playCardId: m.playCardId,
                                        payCardId: m.payCardId,
                                        row: m.row,
                                        col: m.col,
                                        settings: m.settings
                                    }
                                });
                            }, { ...move, color: currentPlayer, settings: aiSettings });
                        } else if (move.type === 'RESOLVE_BONUS') {
                            await page.evaluate((m) => {
                                // @ts-ignore
                                window.store.dispatch({
                                    type: 'game/resolveBonus',
                                    payload: { bonusId: m.bonusId }
                                });
                            }, { ...move });
                        }

                        // Redux dispatch is synchronous; assert the resulting state directly.
                        const stateChanged = await page.evaluate(({ prevTurn, prevBonus, targetBonusId }) => {
                            // @ts-ignore
                            const s = window.store.getState().game;
                            const turnChanged = s.turnCount > prevTurn;

                            let stateChanged = false;
                            if (targetBonusId) {
                                // If we resolved a specific bonus, we expect it to be gone
                                stateChanged = !s.pendingBonuses.some(b => b.id === targetBonusId);
                            } else {
                                // Normal move: Expect turn change OR bonus appearance/count change
                                stateChanged = (s.pendingBonuses.length !== prevBonus);
                            }

                            // Also check for game over
                            const gameOver = s.phase === 'game_over';

                            return turnChanged || stateChanged || gameOver;
                        }, {
                            prevTurn: previousTurnCount,
                            prevBonus: previousBonusCount,
                            targetBonusId: move.type === 'RESOLVE_BONUS' ? move.bonusId : null
                        });
                        expect(stateChanged).toBe(true);
                    }
                }
            ]
        });

        turnCount++;
    }

    // 3. Victory
    await helper.step('999-game-over', {
        description: 'Game Over',
        verifications: [
            {
                spec: 'Winner Declared',
                check: async () => {
                    await expect(page.locator('.game-over-modal')).toBeVisible();
                }
            }
        ]
    });

    helper.generateDocs();
});
