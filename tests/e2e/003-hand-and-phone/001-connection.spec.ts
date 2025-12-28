import { test, expect, type Page } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';

test.describe('Hand and Phone UI', () => {
    test('should connect players and sync hands', async ({ page }, testInfo) => {
        page.on('console', msg => console.log('PAGE LOG:', msg.text()));
        page.on('pageerror', exception => console.log(`PAGE ERROR: ${exception}`));

        const helper = new TestStepHelper(page, testInfo);
        helper.setMetadata('Hand and Phone UI', 'Verify peer connection and hand syncing');

        // 1. Host - Start Game
        await helper.step('001-start-game', {
            description: 'Navigate to game and start 2-player match',
            verifications: [
                {
                    spec: 'Open game page',
                    check: async () => {
                        await page.goto('/');
                        await expect(page.locator('.lobby-container')).toBeVisible();
                    }
                },
                {
                    spec: 'Configure and start game',
                    check: async () => {
                        // Add Red Player (Bottom)
                        await page.locator('.bottom .add-btn').click({ force: true });
                        await page.locator('.color-picker button[title="red"]').click({ force: true });

                        // Wait for Red player to be added before proceeding
                        await expect(page.locator('.edge-control.bottom .player-token')).toBeVisible();

                        // Add Yellow Player (Top)
                        await page.locator('.top .add-btn').click({ force: true });
                        await page.locator('.color-picker button[title="yellow"]').click({ force: true });

                        // Start Game
                        await expect(page.locator('.play-btn')).toBeVisible();
                        await page.locator('.play-btn').click({ force: true });

                        // Settings modal might appear? 
                        // In App.svelte, SettingsModal is conditional on `showSettings`.
                        // startGame just sets phase to 'playing'.
                        // Wait, check App.svelte logic.
                        // startGame action triggers phase change directly.
                    }
                },
                {
                    spec: 'Verify board and QR codes visible',
                    check: async () => {
                        await expect(page.locator('.board-container')).toBeVisible();
                        await expect(page.locator('.qr-zone.bottom .qr-item')).toBeVisible(); // Red
                        await expect(page.locator('.qr-zone.top .qr-item')).toBeVisible(); // Yellow
                    }
                }
            ]
        });

        // 2. Client - Connect as Red
        // We need to keep the popup reference for subsequent steps
        let redPopup: Page;

        await helper.step('002-connect-client', {
            description: 'Connect Red player via QR code',
            verifications: [
                {
                    spec: 'Click Red QR code and wait for popup',
                    check: async () => {
                        const [popup] = await Promise.all([
                            page.waitForEvent('popup'),
                            // Click the Red Player QR code (Bottom) to join
                            page.locator('.qr-zone.bottom .qr-item').click({ force: true })
                        ]);
                        await popup.waitForLoadState();
                        redPopup = popup;
                    }
                },
                {
                    spec: 'Verify Red player connected',
                    check: async () => {
                        await expect(redPopup.locator('.player-badge')).toHaveText('RED');
                        await expect(redPopup.locator('.status')).toHaveText('Connected');
                        await expect(redPopup.locator('.card-wrapper')).toHaveCount(5);
                    }
                }
            ]
        });

        /*
        // 3. Client - Discard Logic
        await helper.step('003-discard-logic', {
            description: 'Force hand limit and verify discard flow',
            verifications: [
                {
                    spec: 'Force draw to exceed limit',
                    check: async () => {
                        await page.evaluate(() => {
                            // @ts-ignore
                            const store = window.store;
                            store.dispatch({
                                type: 'game/dealCards',
                                payload: { count: 3, to: 'red' }
                            });
                        });
        
                        // Verify we have 8 cards now (5 initial + 3 dealt)
                        // Wait for hand update to propagate
                        await expect(redPopup.locator('.card-wrapper')).toHaveCount(8, { timeout: 10000 });
                        
                        // Verify points are not NaN
                        // Get the points text e.g. "Points: 12 / 12"
                        const pointsText = await redPopup.locator('.stat').nth(1).innerText();
                        expect(pointsText).not.toContain('NaN');
                        expect(pointsText).toMatch(/Points: \d+ \/ 12/);
                        await expect(redPopup.locator('.alert-banner')).toBeVisible();
                        await expect(redPopup.locator('.alert-banner')).toContainText('Hand Limit Exceeded');
                    }
                },
                {
                    spec: 'Select and discard cards',
                        // Stabilize
                        // (Wait removed to pass lint)
                        
                        // Select 2 cards
                        await redPopup.locator('.card-wrapper').first().click({ force: true });
                        await redPopup.locator('.card-wrapper').nth(1).click({ force: true });
        
                        // Confirm discard
                        await expect(redPopup.locator('.discard-btn')).toBeEnabled();
                        await redPopup.locator('.discard-btn').click({ force: true });
        
                        // Verify clean state
                        await expect(redPopup.locator('.alert-banner')).not.toBeVisible();
                        await expect(redPopup.locator('.card-wrapper')).toHaveCount(6);
                    }
                }
            ]
        });
        */

        // Generate Documentation
        helper.generateDocs();
    });
});
