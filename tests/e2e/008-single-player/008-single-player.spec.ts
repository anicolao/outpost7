import { test, expect, type Page } from '@playwright/test';
import { TestStepHelper, waitForAnimations } from '../helpers/test-step-helper';

async function waitForAiResponse(page: Page) {
    let previousStage: string | null = null;
    for (let stageCount = 0; stageCount < 16; stageCount++) {
        const result = await page.evaluate((lastStage) => {
            // @ts-ignore exposed by the E2E app
            const store = window.store;
            const signal = AbortSignal.timeout(2000);

            return new Promise<{ done: boolean; stage: string | null }>((resolve, reject) => {
                let unsubscribe = () => {};
                const observer = new MutationObserver(check);
                const cleanup = () => {
                    signal.removeEventListener('abort', abort);
                    observer.disconnect();
                    unsubscribe();
                };
                const finish = (done: boolean, stage: string | null) => {
                    cleanup();
                    resolve({ done, stage });
                };
                const abort = () => {
                    cleanup();
                    reject(new Error(`AI feedback did not advance from ${lastStage ?? 'the human move'} within 2000ms`));
                };
                function check() {
                    const game = store.getState().game;
                    const yellowPlayed = game.grid
                        .flat()
                        .some((cell: any) => cell?.owner === 'yellow');
                    const stage = document.querySelector('.ai-action-feedback')?.getAttribute('data-stage') ?? null;

                    if (
                        game.turnCount > 1
                        && yellowPlayed
                        && game.currentTurn === 'red'
                        && game.pendingBonuses.length === 0
                    ) {
                        finish(true, stage);
                    } else if (stage && stage !== lastStage) {
                        finish(false, stage);
                    }
                }

                signal.addEventListener('abort', abort, { once: true });
                unsubscribe = store.subscribe(check);
                observer.observe(document.body, { childList: true, subtree: true, attributes: true });
                check();
            });
        }, previousStage);

        if (result.done) return;
        previousStage = result.stage;
    }

    throw new Error('AI feedback exceeded 16 event-driven stages');
}

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
                        await page.goto('/?seed=e2e_test_solo&gameId=e2e_solo'); // Use simple seed
                        await expect(page.locator('.lobby-container')).toBeVisible();

                        // Keep the historical solo scenario's base-cube rule in
                        // the host settings snapshot rather than injecting it
                        // into an individual play action.
                        await page.locator('.settings-btn.top-left').click();
                        await page.locator('[data-setting-key="CUBES_PER_PLAY"] button', { hasText: '+' }).click();
                        await expect(page.locator('[data-setting-key="CUBES_PER_PLAY"] .value')).toHaveText('1');
                        await page.locator('.modal .close-btn').click();

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
                },
                {
                    spec: 'Only the human player has a join QR code',
                    check: async () => {
                        const humanJoin = page.locator('.qr-zone.bottom .qr-item');
                        await expect(humanJoin).toBeVisible();
                        await expect(humanJoin).toContainText('RED JOIN');
                        await expect(page.locator('.qr-zone.top .qr-item')).toHaveCount(0);
                        await expect(page.getByText('YELLOW JOIN', { exact: true })).toHaveCount(0);
                    }
                }
            ]
        });

        // 2. Play Human Move
        await helper.step('002-human-move', {
            description: 'Human move triggers the AI reply',
            verifications: [
                {
                    spec: 'Red plays a card and Yellow completes its response',
                    check: async () => {
                        // Ensure it's Red's turn
                        await expect(page.locator('.turn-indicator')).toHaveText(/RED TURN/i);

                        await page.evaluate(() => {
                            // @ts-ignore
                            const store = window.store;
                            const game = store.getState().game;
                            const hand = game.hands.red;
                            // Find valid pair
                            let playCard, payCard;
                            for (let i = 0; i < hand.length; i++) {
                                for (let j = 0; j < hand.length; j++) {
                                    if (i === j) continue;
                                    const overpayment = Math.max(0, hand[j].cost - hand[i].cost);
                                    const colorMatch = hand[j].color === hand[i].color
                                        ? game.settings.CUBES_PER_COLOR_MATCH
                                        : 0;
                                    const cubes = game.settings.CUBES_PER_PLAY
                                        + colorMatch
                                        + overpayment * game.settings.CUBES_PER_OVERPAYMENT;
                                    if (
                                        hand[j].cost >= hand[i].cost
                                        && (cubes > 0 || game.settings.ALLOW_ZERO_CUBE_REPAIRS)
                                    ) {
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
                        await waitForAiResponse(page);
                    }
                }
            ]
        });

        // 3. Verify AI Response
        await helper.step('003-verify-ai-response', {
            description: 'AI returns control to the human',
            verifications: [
                {
                    spec: 'Yellow has played, all bonuses are resolved, and it is Red’s turn again',
                    check: async () => {
                        await expect(page.locator('.turn-indicator')).toHaveText(/RED TURN/i);
                        await expect(page.locator('.played-card')).toHaveCount(2);
                    }
                }
            ]
        });

        helper.generateDocs();
    });
});
