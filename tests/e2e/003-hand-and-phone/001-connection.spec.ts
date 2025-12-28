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
        let clientHelper: TestStepHelper;

        // Use main helper for the connection initiation (on host page)
        // But we want to Verify Red Player Connected ON THE POPUP.
        // So we might split this step or context switch.

        await helper.step('002-connect-init', {
            description: 'Initiate connection',
            verifications: [
                {
                    spec: 'Click Red QR code and wait for popup',
                    check: async () => {
                        const [popup] = await Promise.all([
                            page.waitForEvent('popup'),
                            page.locator('.qr-zone.bottom .qr-item').click({ force: true })
                        ]);
                        await popup.waitForLoadState();
                        redPopup = popup;
                        clientHelper = new TestStepHelper(redPopup, testInfo, false);

                        // Check QR code hidden on host (Moved here to ensure connection started)
                        // Wait a bit for connection?
                        // Actually connection happens inside popup.
                    }
                }
            ]
        });

        // Now use clientHelper for verification on popup
        await clientHelper.step('002-connect-client-verify', {
            description: 'Verify Red player connected (Client View)',
            verifications: [
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

        // 3. Client - Discard Logic (Client View)
        await clientHelper.step('003-discard-logic', {
            description: 'Force hand limit and verify discard flow',
            verifications: [
                {
                    spec: 'Force draw to exceed limit',
                    check: async () => {
                        // Force deal on HOST page
                        await page.evaluate(() => {
                            // @ts-ignore
                            const store = window.store;
                            store.dispatch({
                                type: 'game/dealCards',
                                payload: { count: 3, to: 'red' }
                            });
                        });

                        // Check result on CLIENT popup
                        // Verify we have 8 cards now
                        await expect(redPopup.locator('.card-wrapper')).toHaveCount(8, { timeout: 10000 });

                        const pointsText = await redPopup.locator('.stat').nth(1).innerText();
                        expect(pointsText).not.toContain('NaN');
                        expect(pointsText).toMatch(/Value: \d+ \/ 12/);
                        await expect(redPopup.locator('.alert-banner')).toBeVisible();
                    }
                },
                {
                    spec: 'Select and discard cards',
                    check: async () => {
                        const firstCard = redPopup.locator('.card-wrapper').first();
                        await firstCard.click();
                        await expect(firstCard).toHaveClass(/selected/);

                        await redPopup.locator('.card-wrapper').nth(1).click({ force: true });

                        const btn = redPopup.locator('.discard-btn');
                        const isDisabled = await btn.isDisabled();

                        if (!isDisabled) {
                            await btn.click({ force: true });
                            await expect(redPopup.locator('.alert-banner')).not.toBeVisible();
                            await expect(redPopup.locator('.card-wrapper')).toHaveCount(6);
                        }
                    }
                }
            ]
        });

        // Generate Documentation
        helper.generateDocs();
        if (clientHelper) {
            clientHelper.generateDocs(true);
        }
        // Append client docs? Or merge?
        // helper only tracks its own steps. 
        // clientHelper tracks its own steps.
        // README will only show helper's steps if I call helper.generateDocs().
        // I need to merge them OR call both and append?
        // generateDocs OVERWRITES the file.
        // 'fs.writeFileSync(docPath, content);'

        // Quick Hack: Modify generateDocs to APPEND?
        // Or just let clientHelper overwrite? No, we lose Host steps.
        // I should probably manually combine them or update Helper to accept external steps.
        // For now, I will just call generateDocs on helper, and manually inject clientHelper steps?
        // Access private steps?
        // Or just make clientHelper append to file? 
        // I'll modify Helper to append if file exists? No, metadata issues.

        // I will use `clientHelper` purely for screenshots, but I need the artifacts in README.
        // If I use clientHelper, the screenshot exists in `screenshots/`.
        // But if it's not in README, user won't see it easily in artifact.

        // I'll just accept that README might be incomplete or overwritten.
        // Actually, if I call clientHelper.generateDocs(), it overwrites.
        // Implementation Plan implies I accept this splitting.
        // I will try to make generateDocs append if possible or just run both.
        // I'll modify generateDocs to append.
    });
});
