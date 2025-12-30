import { test, expect, type Page } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';

test.describe('Gameplay Loop', () => {
    test('should allow selection and card placement', async ({ page }, testInfo) => {
        const helper = new TestStepHelper(page, testInfo);
        helper.setMetadata('Gameplay Loop', 'Verify full gameplay cycle: Selection -> Visuals -> Placement');

        // Debug Host Logs
        page.on('console', msg => console.log('HOST LOG:', msg.text()));

        // 1. Host - Start Game
        await helper.step('001-setup-host', {
            description: 'Start Game with Red Player',
            verifications: [
                {
                    spec: 'Add Red Player and Start',
                    check: async () => {
                        await page.goto('/?seed=e2e_test&hostId=e2e_host_gameplay');
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
                        await qrItem.waitFor({ state: 'visible' });

                        const [popup] = await Promise.all([
                            page.waitForEvent('popup'),
                            qrItem.click({ force: true })
                        ]);
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
                            console.log('Discard complete.');
                        } else {
                            console.log('Hand Limit OK.');
                        }
                    }
                }
            ]
        });

        // 3. Client - Select Play/Pay
        // We'll treat this as a "Manual Step" in the Host's doc flow, implies action on user device
        // But we automate it here.
        await helper.step('003-client-selection', {
            description: 'Red Player Selects Play and Pay Cards',
            page: redPage, // Use Client Page for screenshot
            verifications: [
                {
                    spec: 'Select Valid Play/Pay Pair',
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
                        // Click 0,0
                        const target = page.locator('[data-cell-id="0-0"]');
                        await target.click({ force: true });
                    }
                },
                {
                    spec: 'Wait for animation and placement',
                    check: async () => {
                        // Animation takes ~600ms
                        // Check for flying card existence then disappearance
                        // Might be too fast to catch existence reliably in step check, 
                        // but we check the final result: cell has content?
                        // Currently grid stores ID. 
                        // We haven't implemented rendering the CARD in the cell yet in Board.svelte?
                        // Wait, I saw `{#if cell} <!-- Grid content logic if needed --> {/if}` in Board.svelte...
                        // I DID NOT IMPLEMENT RENDER!
                        // The reducer updates the grid, but the UI is empty!
                        // "The card, when placed, should have the initial cube state on it..."
                        // I only stored the ID.
                        // And the template has: `{#if cell} ... {/if}` empty.
                        // I missed rendering the placed card in the template! 
                        // I need to fix Board.svelte first.

                        // Verify cell has the card content (CardDisplay)
                        const cell = page.locator('[data-cell-id="0-0"]');
                        // Use .card-bg to verify the card component is present
                        await expect(cell.locator('.card-bg')).toBeVisible();

                        console.log('Verified Card Rendered (CardDisplay)');

                        // Verify turn passed to Yellow
                        // Note: If a bonus was triggered (e.g. ADD_CUBE), we enter BONUS PHASE first.
                        await expect.poll(async () => {
                            const text = await page.locator('.turn-indicator').innerText();
                            if (text === 'BONUS PHASE') {
                                // Auto-resolve bonus if we stumbled into one
                                await page.locator('.resolve-btn').click();
                                return 'RESOLVING';
                            }
                            return text;
                        }, { timeout: 3000 }).toContain('YELLOW TURN');
                    }
                }
            ]
        });

        // STOP: I noticed I missed the UI rendering for the grid cell.
        // I need to update Board.svelte to render the placed card.
        // I will finish writing this test file, but comment out the final check or expect failure.
        // Actually, better to fix the code first.
        // I'll write the test file but know I need to pause and fix Board.svelte.
        helper.generateDocs();
    });
});
