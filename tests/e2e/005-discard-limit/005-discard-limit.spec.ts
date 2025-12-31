import { test, expect, type Page } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';

test.describe('Discard Flow', () => {
    test.skip('should allow discarding when over limit', async ({ page }, testInfo) => {
        const helper = new TestStepHelper(page, testInfo);
        helper.setMetadata('Discard Flow', 'Verify player can discard when over hand limit');

        // 1. Host - Start Game
        await helper.step('001-setup', {
            description: 'Start Game',
            verifications: [
                {
                    spec: 'Start Game',
                    check: async () => {
                        await page.goto('/?seed=e2e_test&hostId=e2e_host_discard');
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
                            page.waitForEvent('popup'),
                            page.locator('.qr-zone.bottom .qr-item').click({ force: true })
                        ]);
                        await popup.waitForLoadState();
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
                            await redPage.evaluate(() => new Promise(r => setTimeout(r, 200)));
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
});
