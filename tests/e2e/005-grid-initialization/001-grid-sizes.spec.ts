import { test, expect } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';

test.describe('Grid Initialization', () => {
    test('Verify selectable Grid Sizes from 2x2 to 6x6', async ({ page }, testInfo) => {
        test.setTimeout(90_000);
        const tester = new TestStepHelper(page, testInfo);

        tester.setMetadata(
            'Grid Size Initialization',
            '**As a** player, **I want** the game board to correctly reflect the configured grid size, **so that** I can play on different board sizes.'
        );

        // Define sizes to test
        const sizes = [2, 3, 4, 5, 6];

        for (const size of sizes) {
            await test.step(`Testing ${size}x${size} Grid`, async () => {
                // 1. Load Page
                await page.goto('/?seed=test_seed_grid&gameId=e2e_grid_sizes');

                await tester.step(`load-page-${size}`, {
                    description: `Load Game for ${size}x${size} Test`,
                    verifications: [
                        {
                            spec: 'Lobby is visible',
                            check: async () => await expect(page.locator('.lobby-container')).toBeVisible()
                        }
                    ]
                });

                // 2. Open Settings
                await page.click('.settings-btn.top-left');
                await expect(page.locator('.modal')).toBeVisible();
                await page.getByRole('button', { name: 'Setup rules' }).click();

                // 3. Select Grid Size
                const rowValueEl = page.locator('[data-setting-key="GRID_ROWS"] .value');
                const colValueEl = page.locator('[data-setting-key="GRID_COLS"] .value');
                await rowValueEl.selectOption(String(size));
                await colValueEl.selectOption(String(size));

                await page.locator('.modal .content').evaluate((element) => {
                    element.scrollTop = 0;
                });

                await tester.step(`settings-updated-${size}`, {
                    description: `Update Settings to ${size}x${size}`,
                    verifications: [
                        {
                            spec: `Rows set to ${size}`,
                            check: async () => await expect(rowValueEl).toHaveValue(String(size))
                        },
                        {
                            spec: `Cols set to ${size}`,
                            check: async () => await expect(colValueEl).toHaveValue(String(size))
                        }
                    ]
                });

                // 4. Close Settings
                await page.click('.close-btn');
                await expect(page.locator('.modal')).not.toBeVisible();

                // 5. Add Players (Red and Yellow)
                // Bottom (Red)
                await page.click('.edge-control.bottom .add-btn');
                await page.click('.color-picker .color-btn[title="red"]');

                // Top (Yellow)
                await page.click('.edge-control.top .add-btn');
                await page.click('.color-picker .color-btn[title="yellow"]');

                // 6. Start Game
                await page.click('.play-btn');

                // 7. Verify Board
                const totalCells = size * size;
                const totalColHeaders = size;
                const totalRowHeaders = size;

                await tester.step(`board-verified-${size}`, {
                    description: `Verify ${size}x${size} Board Layout`,
                    verifications: [
                        {
                            spec: 'Board container is visible',
                            check: async () => await expect(page.locator('.board-container')).toBeVisible()
                        },
                        {
                            spec: `Correct number of cells (${totalCells})`,
                            check: async () => await expect(page.locator('.cell')).toHaveCount(totalCells)
                        },
                        {
                            spec: `Correct number of column headers (${totalColHeaders})`,
                            check: async () => await expect(page.locator('.header-cell.top-header')).toHaveCount(totalColHeaders)
                        },
                        {
                            spec: `Correct number of row headers (${totalRowHeaders})`,
                            check: async () => await expect(page.locator('.header-cell.row-header')).toHaveCount(totalRowHeaders)
                        }
                    ]
                });
            });
        }

        tester.generateDocs();
    });
});
