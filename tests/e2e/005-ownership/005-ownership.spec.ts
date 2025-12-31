
import { test, expect, type Page } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';

test.describe('Ownership Evaluation', () => {
    test('Verify Ownership Flip', async ({ page }) => {
        // Set E2E Flag
        await page.addInitScript(() => {
            // @ts-ignore
            window.E2E_TEST = true;
        });

        const helper = new TestStepHelper(page, test.info());
        helper.setMetadata('Ownership Loop', 'Verify ownership updates when gaining majority in a row');

        // 1. Host - Start Game
        await helper.step('001-setup-host', {
            description: 'Start Game with Red and Yellow',
            verifications: [
                {
                    spec: 'Add Players and Start',
                    check: async () => {
                        await page.goto('/?seed=e2e_ownership&hostId=e2e_host_ownership');
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

        // 2. Client - Connect Red
        let redPage: Page = null as any;
        await helper.step('002-connect-red', {
            description: 'Connect Red Player',
            verifications: [
                {
                    spec: 'Open Red Client',
                    check: async () => {
                        const qrItem = page.locator('.qr-zone.bottom .qr-item');
                        await qrItem.waitFor({ state: 'visible' });
                        const [popup] = await Promise.all([
                            page.waitForEvent('popup'),
                            qrItem.click({ force: true })
                        ]);
                        await popup.waitForLoadState();
                        redPage = popup;
                        await expect(redPage.locator('.status')).toHaveText('Connected');
                        await expect(page.locator('.qr-zone.bottom')).toBeHidden();
                    }
                }
            ]
        });

        // 3. Client - Select Play/Pay
        await helper.step('003-client-play', {
            description: 'Red Plays Card into Row 1',
            page: redPage,
            verifications: [
                {
                    spec: 'Select and Play Card',
                    check: async () => {
                        // Wait for hand
                        await redPage.waitForSelector('.card-wrapper');

                        // Check for Discard Phase (Over Limit)
                        if (await redPage.locator('.alert-banner').isVisible()) {
                            // Simply discard the highest cost cards until valid
                            // We loop because we might need to discard multiple
                            while (await redPage.locator('.alert-banner').isVisible()) {
                                // Find highest cost card
                                const cardToDiscardIndex = await redPage.evaluate(() => {
                                    const cards = Array.from(document.querySelectorAll('.card-wrapper'));
                                    let maxCost = -1;
                                    let maxIndex = -1;
                                    cards.forEach((el, index) => {
                                        // Ignore already selected
                                        if (el.classList.contains('discard-selected')) return;
                                        const valueText = el.querySelector('.card-value')?.textContent || '0';
                                        const cost = parseInt(valueText, 10);
                                        if (cost > maxCost) {
                                            maxCost = cost;
                                            maxIndex = index;
                                        }
                                    });
                                    return maxIndex;
                                });

                                if (cardToDiscardIndex !== -1) {
                                    await redPage.locator('.card-wrapper').nth(cardToDiscardIndex).click();
                                }

                                // Try to confirm
                                const btn = redPage.locator('.discard-btn');
                                if (await btn.isEnabled()) {
                                    await btn.click();
                                    await redPage.waitForTimeout(500); // Wait for transition
                                }
                            }
                            await expect(redPage.locator('.alert-banner')).not.toBeVisible();
                            // Reset selection context? No, discard is done.
                        }

                        // Select Pair
                        const indices = await redPage.evaluate(() => {
                            const cards = Array.from(document.querySelectorAll('.card-wrapper'));
                            const cardData = cards.map((el, index) => {
                                const valueText = el.querySelector('.card-value')?.textContent || '0';
                                return { index, cost: parseInt(valueText, 10) };
                            });
                            for (let i = 0; i < cardData.length; i++) {
                                for (let j = 0; j < cardData.length; j++) {
                                    if (i === j) continue;
                                    if (cardData[j].cost >= cardData[i].cost) {
                                        return { playIndex: i, payIndex: j };
                                    }
                                }
                            }
                            return null;
                        });

                        if (!indices) throw new Error('No valid play pair');

                        const cards = redPage.locator('.card-wrapper');

                        // Click Play Card and Verify
                        await cards.nth(indices.playIndex).click({ force: true });
                        await expect(cards.nth(indices.playIndex).locator('.selected-overlay.play')).toBeVisible();

                        // Click Pay Card and Verify
                        await cards.nth(indices.payIndex).click({ force: true });
                        await expect(cards.nth(indices.payIndex).locator('.selected-overlay.pay')).toBeVisible();
                    }
                }
            ]
        });

        // 4. Host - Execute Move
        await helper.step('004-execute-move', {
            description: 'Place card in Row 1 Col 0',
            verifications: [
                {
                    spec: 'Click Row 1 Col 0',
                    check: async () => {
                        // Wait for Host to receive selection (Face Down Card)
                        await expect(page.locator('.face-down-card.bottom')).toBeVisible();

                        // Ensure it's Red's Turn
                        await expect(page.locator('.turn-indicator')).toHaveText('RED TURN');

                        // Row 1
                        const cell = page.locator('[data-cell-id="1-0"]');
                        await cell.click({ force: true });

                        // Wait for card to appear
                        await expect(cell.locator('.card-bg')).toBeVisible();
                    }
                }
            ]
        });

        // 5. Host - Verify Ownership Flip
        await helper.step('005-verify-ownership', {
            description: 'Check Row 1 Ownership is Red',
            verifications: [
                {
                    spec: 'Row 1 Header should be Red',
                    check: async () => {
                        // Wait for turn end (Yellow Turn or Bonus)
                        // This implies ownership logic ran
                        await expect.poll(async () => {
                            return await page.locator('.turn-indicator').innerText();
                        }, { timeout: 3000 }).toMatch(/BONUS ACTIONS|YELLOW TURN/);

                        // Evaluate Row 1 Header (Index 1)
                        // .row-header are rendered in order
                        const rowHeader = page.locator('.header-cell.row-header').nth(1);
                        const svg = rowHeader.locator('svg');

                        // Check fill color: Red = #ff4d4d
                        await expect(svg).toHaveAttribute('fill', '#ff4d4d');
                    }
                }
            ]
        });

        helper.generateDocs();
    });
});
