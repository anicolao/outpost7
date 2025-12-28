import { test, expect } from '@playwright/test';
import { TestStepHelper, waitForAnimations } from '../helpers/test-step-helper';

test.describe('Settings and Cards UI Checks', () => {
    let stepHelper: TestStepHelper;

    test.beforeEach(async ({ page }, testInfo) => {
        stepHelper = new TestStepHelper(page, testInfo);
        stepHelper.setMetadata('Settings and Cards', 'Verify opening settings, editing values, and navigating to cards.');
        await page.goto('/');
        await waitForAnimations(page); // Wait for app to hydrate/stabilize
        await expect(page.locator('.lobby-container')).toBeVisible();
    });

    test.afterEach(async () => {
        stepHelper.generateDocs();
    });

    test('should allow opening settings, editing values, and navigating to cards', async ({ page }) => {
        // 1. Open Settings
        await stepHelper.step('open-settings', {
            description: 'Open Settings Modal',
            verifications: [{
                spec: 'Clicking corner gear icon opens settings modal',
                check: async () => {
                    const settingsBtn = page.locator('.settings-btn.top-left');
                    await expect(settingsBtn).toBeVisible();
                    await settingsBtn.click();

                    const modal = page.locator('.modal');
                    await expect(modal).toBeVisible();
                    await expect(page.locator('.header h2')).toHaveText('Game Settings');
                }
            }]
        });

        // 2. Edit a Setting
        await stepHelper.step('edit-setting', {
            description: 'Edit Game Setting',
            verifications: [{
                spec: 'Clicking + updates the setting value',
                check: async () => {
                    const settingItem = page.locator('.setting-item', { hasText: 'Cubes gained for color match' });
                    const valueSpan = settingItem.locator('.value');
                    const plusBtn = settingItem.locator('button', { hasText: '+' });

                    await expect(valueSpan).toHaveText('1');
                    await plusBtn.click();
                    await expect(valueSpan).toHaveText('2');
                }
            }]
        });

        // 3. Navigate to Cards
        await stepHelper.step('nav-cards', {
            description: 'Navigate to Card Library',
            verifications: [{
                spec: 'Clicking Open Card Library switches to Cards Modal',
                check: async () => {
                    const cardsBtn = page.locator('button', { hasText: 'Open Card Library...' });
                    await expect(cardsBtn).toBeVisible();
                    await cardsBtn.click();

                    const cardHeader = page.locator('.header h2', { hasText: 'Card Library' });
                    await expect(cardHeader).toBeVisible();
                    await expect(page.locator('.card-grid')).toBeVisible();
                }
            }]
        });

        // 4. Close Cards
        await stepHelper.step('close-cards', {
            description: 'Close Modals',
            verifications: [{
                spec: 'Clicking close button dismisses modal',
                check: async () => {
                    const closeBtn = page.locator('.close-btn');
                    await closeBtn.click();
                    await expect(page.locator('.modal')).toBeHidden();
                }
            }]
        });

        // 5. Verify Settings Effect (Grid Dimensions)
        await stepHelper.step('verify-settings-effect', {
            description: 'Verify Grid Settings Apply to Board',
            verifications: [{
                spec: 'Board grid cells reflect changed rows setting',
                check: async () => {
                    // Open Settings again
                    await page.locator('.settings-btn.top-left').click();

                    // Change Grid Rows to 4 (default 5)
                    const rowsRow = page.locator('.setting-item', { hasText: 'Grid Rows' });
                    const rowsVal = rowsRow.locator('.value');
                    const minusBtn = rowsRow.locator('button', { hasText: '-' });

                    await expect(rowsVal).toHaveText('5');
                    await minusBtn.click();
                    await expect(rowsVal).toHaveText('4');

                    // Close Settings
                    await page.locator('.close-btn').click();

                    // Start Game (Add 2 players)
                    const bottomEdge = page.locator('.edge-control.bottom');
                    await bottomEdge.locator('.add-btn').click();

                    // Wait for picker to appear and stabilize
                    const bottomPicker = bottomEdge.locator('.color-picker');
                    await expect(bottomPicker).toBeVisible();
                    await expect(bottomPicker).toHaveCSS('opacity', '1');

                    // Click color "red"
                    await bottomPicker.locator('button[title="red"]').click();

                    // Wait for picker to hide (implies state update)
                    await expect(bottomPicker).toBeHidden();
                    // Ensure add button is NOT shown (implies token must be shown or broken state)
                    await expect(bottomEdge.locator('.add-btn')).toBeHidden();
                    // Check token
                    await expect(bottomEdge.locator('.player-token')).toBeVisible({ timeout: 10000 });


                    const topEdge = page.locator('.edge-control.top');
                    await topEdge.locator('.add-btn').click();

                    // Wait for picker to appear and stabilize
                    const topPicker = topEdge.locator('.color-picker');
                    await expect(topPicker).toBeVisible();
                    await expect(topPicker).toHaveCSS('opacity', '1');

                    // Click color "yellow"
                    await topPicker.locator('button[title="yellow"]').click();

                    // Wait for picker to hide
                    await expect(topPicker).toBeHidden();
                    await expect(topEdge.locator('.add-btn')).toBeHidden();
                    // Check token
                    await expect(topEdge.locator('.player-token')).toBeVisible({ timeout: 10000 });

                    // Click Play
                    const playBtn = page.locator('.play-btn');
                    await expect(playBtn).toBeVisible({ timeout: 5000 });
                    await playBtn.click();

                    // Verify Board
                    await expect(page.locator('.board-container')).toBeVisible();

                    // Grid should have --rows: 4
                    const grid = page.locator('.grid');
                    await expect(grid).toHaveAttribute('style', /--rows:\s*4/);

                    // Cell count should be 4 * 5 = 20
                    await expect(page.locator('.cell')).toHaveCount(20);
                }
            }]
        });
    });
});
