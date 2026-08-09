import { test, expect, type Page } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';

test.describe('Gameplay Loop', () => {
    test('Gameplay Loop', async ({ page }) => {
        // Set E2E Flag to skip animations
        await page.addInitScript(() => {
            // @ts-ignore
            window.E2E_TEST = true;
        });

        const helper = new TestStepHelper(page, test.info());
        helper.setMetadata('Gameplay Loop', 'Verify full gameplay cycle: Selection -> Visuals -> Placement -> Interactive Bonus');

        // Debug Host Logs
        page.on('console', msg => console.log('HOST LOG:', msg.text()));

        // 1. Host - Start Game
        await helper.step('001-setup-host', {
            description: 'Start Game with Red Player',
            verifications: [
                {
                    spec: 'Add Red Player and Start',
                    check: async () => {
                        await page.goto('/?seed=e2e_test&gameId=e2e_host_gameplay');
                        await page.locator('.bottom .add-btn').click({ force: true });
                        await page.locator('.color-picker button[title="red"]').click({ force: true });
                        await expect(page.locator('.edge-control.bottom .player-token')).toBeVisible();

                        // Add Yellow too for valid game start requirements if any
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
            description: 'Connect Red Player via QR',
            verifications: [
                {
                    spec: 'Open Red Client',
                    check: async () => {
                        const qrItem = page.locator('.qr-zone.bottom .qr-item');
                        await qrItem.waitFor({ state: 'visible', timeout: 5000 });

                        // Ensure it's stable and clickable
                        await expect(qrItem).toBeVisible();

                        console.log('Attempting to click QR code for popup...');
                        // Use a slightly longer timeout for the popup event
                        const [popup] = await Promise.all([
                            page.waitForEvent('popup', { timeout: 15000 }),
                            qrItem.click() // Removing force: true to ensure it's actually clickable/visible
                        ]);

                        console.log('Popup detected, waiting for load...');
                        await popup.waitForLoadState();
                        redPage = popup;

                        await expect(redPage.locator('.status')).toHaveText('Connected');
                        await expect(redPage.locator('.card-wrapper')).toHaveCount(5); // Initial deal

                        // Ensure Host recognizes connection (hiding QR) before snapshot
                        await expect(page.locator('.qr-zone.bottom')).toBeHidden();
                    }
                }
            ]
        });

        // 2.5 Client - Handle Initial Discard (if over limit)
        await helper.step('002_5-initial-discard', {
            description: 'Red Player Discards if Over Limit',
            page: redPage, // Use Client Page for screenshot
            verifications: [
                {
                    spec: 'Discard down to limit',
                    check: async () => {
                        // Check if alert banner exists
                        const alert = redPage.locator('.alert-banner');
                        if (await alert.isVisible()) {
                            console.log('Hand Limit Exceeded - Discarding...');
                            await expect(redPage.getByRole('button', { name: 'Discard', exact: true })).toHaveCount(0);
                            const cards = redPage.locator('.card-wrapper');
                            const confirmBtn = redPage.locator('.discard-btn');

                            // Select cards until Confirm is enabled
                            let i = 0;
                            let selectedCount = 0;
                            while (await confirmBtn.isDisabled() && i < 5) {
                                console.log(`Selecting card ${i} for discard...`);
                                await cards.nth(i).click({ force: true });
                                selectedCount++;
                                // Wait briefly for UI update
                                await redPage.evaluate(() => new Promise(r => setTimeout(r, 200)));
                                i++;
                            }
                            console.log(`Selected ${selectedCount} cards. Enable state: ${!(await confirmBtn.isDisabled())}`);
                            await confirmBtn.click({ force: true });
                            await expect(alert).toBeHidden();
                            await expect(redPage.getByRole('button', { name: 'Play', exact: true })).toHaveClass(/active/);
                            await expect(redPage.getByRole('button', { name: 'Discard', exact: true })).toBeVisible();
                            console.log('Discard complete.');
                        } else {
                            console.log('Hand Limit OK.');
                        }
                    }
                }
            ]
        });

        // 3. Client - Select Play/Pay
        await helper.step('003-client-selection', {
            description: 'Red Player Selects Play and Pay Cards',
            page: redPage, // Use Client Page for screenshot
            verifications: [
                {
                    spec: 'Select Valid Play/Pay pair',
                    check: async () => {
                        // Wait for hand to stabilize
                        await redPage.evaluate(() => new Promise(r => setTimeout(r, 2000)));

                        // Smart Selection Logic: Find a valid pair (Pay >= Play)
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
                                        return { playIndex: i, payIndex: j, playCost: cardData[i].cost, payCost: cardData[j].cost };
                                    }
                                }
                            }
                            return null;
                        });

                        if (!indices) {
                            throw new Error('No valid Play/Pay pair found in hand!');
                        }

                        console.log(`Test Selection: Play Index ${indices.playIndex} (Cost ${indices.playCost}), Pay Index ${indices.payIndex} (Cost ${indices.payCost})`);

                        const cards = redPage.locator('.card-wrapper');
                        await cards.nth(indices.playIndex).click({ force: true });
                        console.log('Clicked Play Card');

                        await cards.nth(indices.payIndex).click({ force: true });
                        console.log('Clicked Pay Card');
                    }
                }
            ]
        });

        // 4. Host - Verify Visual Feedback
        await helper.step('004-host-feedback', {
            description: 'Verify Face Down Card and Highlights',
            verifications: [
                {
                    spec: 'Face down card visible at bottom',
                    check: async () => {
                        await expect(page.locator('.face-down-card.bottom')).toBeVisible();
                    }
                },
                {
                    spec: 'Valid cells highlighted',
                    check: async () => {
                        // All empty cells should be valid
                        await expect(page.locator('.cell.valid').first()).toBeVisible();
                    }
                }
            ]
        });

        // 5. Host - Execute Move
        await helper.step('005-execute-move', {
            description: 'Click cell to place card',
            verifications: [
                {
                    spec: 'Click target cell (0,0)',
                    check: async () => {
                        const target = page.locator('[data-cell-id="0-0"]');
                        await target.click();
                    }
                },
                {
                    spec: 'Wait for animation and placement',
                    check: async () => {
                        // Verify cell has the card content (CardDisplay)
                        const cell = page.locator('[data-cell-id="0-0"]');

                        await expect(cell.locator('.card-bg')).toBeVisible({ timeout: 10000 });

                        console.log('Verified Card Rendered (CardDisplay)');

                        // Wait for update - Should enter BONUS ACTIONS or YELLOW TURN
                        await expect.poll(async () => {
                            return await page.locator('.turn-indicator').innerText();
                        }, { timeout: 3000 }).toMatch(/BONUS ACTIONS|YELLOW TURN/);
                    }
                }
            ]
        });

        // 6. Host - Handle Interactive Bonus
        await helper.step('006-resolve-bonus', {
            description: 'Resolve Bonus Phase if Active',
            verifications: [
                {
                    spec: 'Check and Resolve Bonus',
                    check: async () => {
                        const text = await page.locator('.turn-indicator').innerText();
                        if (text === 'BONUS ACTIONS') {
                            console.log('Bonus Actions Active - Resolving...');

                            // Find the interactive cube on the card at 0-0
                            const cell = page.locator('[data-cell-id="0-0"]');
                            const interactiveCube = cell.locator('.player-cube.interactive');

                            await expect(interactiveCube).toBeVisible();
                            console.log('Found interactive cube');

                            // Click it
                            await interactiveCube.click();

                            // Wait for resolution
                            await new Promise(r => setTimeout(r, 600)); // Animation time
                        } else {
                            console.log('No Bonus Phase triggered.');
                        }
                    }
                },
                {
                    spec: 'Verify Final Turn State (Yellow)',
                    check: async () => {
                        await expect(page.locator('.turn-indicator')).toHaveText('YELLOW TURN');
                    }
                }
            ]
        });

        helper.generateDocs();
    });
});
