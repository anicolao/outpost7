import { test, expect } from '@playwright/test';

test.beforeEach(({ page }) => {
    page.on('console', msg => console.log(`BROWSER LOG: ${msg.text()}`));
    page.on('pageerror', err => console.log(`BROWSER ERROR: ${err}`));
});

test('Game Setup Flow', async ({ page }) => {
    await page.goto('/');

    // 1. Verify Lobby - 4 edge buttons
    const bottomAdd = page.locator('.edge-control.bottom .add-btn');
    const topAdd = page.locator('.edge-control.top .add-btn');
    await expect(bottomAdd).toBeVisible();
    await expect(topAdd).toBeVisible();

    // 2. Add Bottom Player (Should get Red)
    await bottomAdd.click();
    const bottomPlayer = page.locator('.edge-control.bottom .player-token');
    await expect(bottomPlayer).toBeVisible();
    await expect(bottomPlayer).toHaveCSS('background-color', 'rgb(255, 77, 77)'); // #ff4d4d

    // 3. Add Top Player (Should get Yellow)
    await topAdd.click();
    const topPlayer = page.locator('.edge-control.top .player-token');
    await expect(topPlayer).toBeVisible();
    await expect(topPlayer).toHaveCSS('background-color', 'rgb(255, 215, 0)'); // #ffd700

    // 4. Verify Play Button appears
    const playBtn = page.locator('.play-btn');
    await expect(playBtn).toBeVisible();

    // 5. Start Game
    await playBtn.click();

    // 6. Verify Board appears
    const board = page.locator('.board-container');
    await expect(board).toBeVisible();

    // 7. Verify Orientation (Bottom+Top => 0deg)
    // Check the style attribute or the rendered text
    await expect(page.getByText('Orientation: 0°')).toBeVisible();
});
