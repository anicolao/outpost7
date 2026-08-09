import { test, expect, type Page } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';

test.describe('Discard Flow', () => {
    test('should allow discarding when over limit', async ({ page }, testInfo) => {
        const helper = new TestStepHelper(page, testInfo);
        helper.setMetadata('Discard Flow', 'Verify player can discard when over hand limit');

        // 1. Host - Start Game
        await helper.step('001-setup', {
            description: 'Start Game',
            verifications: [
                {
                    spec: 'Start Game',
                    check: async () => {
                        await page.goto('/?seed=e2e_test&gameId=e2e_host_discard');
                        await page.locator('.bottom .add-btn').click({ force: true });
                        await page.locator('.color-picker button[title="red"]').click({ force: true });
                        await page.locator('.top .add-btn').click({ force: true });
                        await page.locator('.color-picker button[title="yellow"]').click({ force: true });
                        await page.locator('.play-btn').click({ force: true });
                    }
                }
            ]
        });

        // 2. Client - Connect & Force Over Limit
        let redPage: Page;
        // 2. Client - Connect
        // let redPage: Page; // Already declared above
        await helper.step('002_0-connect-red', {
            description: 'Connect Red Player',
            verifications: [
                {
                    spec: 'Connect Red',
                    check: async () => {
                        const [popup] = await Promise.all([
                            page.waitForEvent('popup', { timeout: 2000 }),
                            page.locator('.qr-zone.bottom .qr-item').click({ force: true })
                        ]);
                        redPage = popup;
                        await expect(redPage.locator('.status')).toHaveText('Connected');

                        // Ensure Host recognizes connection (hiding QR) before snapshot
                        await expect(page.locator('.qr-zone.bottom')).toBeHidden();
                    }
                }
            ]
        });

        // 2.1 Client - Force Limit
        await helper.step('002_1-force-limit', {
            description: 'Deal Cards to Exceed Limit',
            page: redPage!, // Use client page
            verifications: [
                {
                    spec: 'Force Deal to 8 Cards',
                    check: async () => {
                        // Current hand is 5. Deal 3 more. Limit is 7.
                        await page.evaluate(() => {
                            // @ts-ignore
                            const store = window.store;
                            store.dispatch({
                                type: 'game/dealCards',
                                payload: { count: 3, to: 'red' }
                            });
                        });

                        // Verify Alert Banner
                        await expect(redPage.locator('.alert-banner')).toBeVisible();
                        await expect(redPage.locator('.card-wrapper')).toHaveCount(8);
                    }
                },
                {
                    spec: 'Discarding is automatic with no manual mode switch',
                    check: async () => {
                        await expect(redPage.locator('.mode-switch')).toHaveCount(0);
                        await expect(redPage.locator('.discard-btn')).toBeVisible();
                    }
                }
            ]
        });

        // 3. Client - Discard Action
        await helper.step('003-perform-discard', {
            description: 'Select and Discard Cards',
            page: redPage!, // Use client page
            verifications: [
                {
                    spec: 'Select and Confirm Discard',
                    check: async () => {
                        const cards = redPage.locator('.card-wrapper');
                        const confirmBtn = redPage.locator('.discard-btn');

                        // Select cards until Confirm is enabled
                        let i = 0;
                        while (await confirmBtn.isDisabled() && i < 8) {
                            await cards.nth(i).click({ force: true });
                            await expect(cards.nth(i)).toHaveClass(/selected/);
                            i++;
                        }

                        // Verify Confirm
                        await confirmBtn.click({ force: true });

                        // Verify Alert Gone
                        await expect(redPage.locator('.alert-banner')).toBeHidden();

                        // Verify Count Reduced to Limit
                        const count = await redPage.locator('.card-wrapper').count();
                        expect(count).toBeLessThanOrEqual(7);
                    }
                }
            ]
        });

        helper.generateDocs();
    });

    test('should synchronize an immediate opening-hand discard', async ({ page, context }, testInfo) => {
        const helper = new TestStepHelper(page, testInfo);
        helper.setMetadata(
            'Opening Hand Discard',
            'Verify an opening-hand discard is applied by the host and synchronized back to the player'
        );
        const gameId = 'e2e_opening_discard';
        let redPage: Page;

        await helper.step('opening-discard-setup', {
            description: 'Start a game and immediately connect the red player',
            verifications: [
                {
                    spec: 'Red receives the five-card opening hand',
                    check: async () => {
                        await page.goto(`/?seed=seed_0&gameId=${gameId}`);
                        await page.locator('.bottom .add-btn').click();
                        await page.locator('.color-picker button[title="red"]').click();
                        await page.locator('.top .add-btn').click();
                        await page.locator('.color-picker button[title="yellow"]').click();
                        await page.locator('.play-btn').click();
                        await expect(page.locator('.board-container')).toBeVisible();

                        redPage = await context.newPage();
                        await redPage.goto(`/#/hand?game=${gameId}&color=red`);
                        await expect(redPage.locator('.status')).toHaveText('Connected');
                        await expect(redPage.locator('.card-wrapper')).toHaveCount(5);
                    }
                }
            ]
        });

        await helper.step('opening-discard-synchronized', {
            description: 'Discard the over-limit cards and receive the updated hand',
            page: redPage!,
            verifications: [
                {
                    spec: 'Host and player both contain the same three remaining cards',
                    check: async () => {
                        await redPage.locator('[data-card-id="card_50"]').click();
                        await redPage.locator('[data-card-id="card_17"]').click();
                        await expect(redPage.locator('.discard-btn')).toBeEnabled();
                        await redPage.locator('.discard-btn').click();

                        await page.evaluate(() => {
                            // @ts-ignore
                            const store = window.store;
                            const signal = AbortSignal.timeout(2000);

                            return new Promise<void>((resolve, reject) => {
                                let unsubscribe = () => {};
                                const onAbort = () => {
                                    unsubscribe();
                                    reject(new Error('Host hand did not synchronize within 2000ms'));
                                };
                                const check = () => {
                                    if (store.getState().game.hands.red.length === 3) {
                                        signal.removeEventListener('abort', onAbort);
                                        unsubscribe();
                                        resolve();
                                    }
                                };

                                signal.addEventListener('abort', onAbort, { once: true });
                                unsubscribe = store.subscribe(check);
                                check();
                            });
                        });
                        await expect(redPage.locator('.card-wrapper')).toHaveCount(3);
                        await expect(redPage.locator('.alert-banner')).toBeHidden();
                    }
                }
            ]
        });

        helper.generateDocs(true);
    });
});
