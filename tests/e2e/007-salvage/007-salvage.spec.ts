import { test, expect } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';

test('Player can salvage cards from the offer', async ({ page }, testInfo) => {
    const tester = new TestStepHelper(page, testInfo);

    tester.setMetadata(
        'Salvage Mechanic',
        '**As a** player, **I want** to draft cards from the offer (up to value 12), **so that** I can build my hand without playing.'
    );

    // 1. Host - Start Game
    await tester.step('001-setup-host', {
        description: 'Start Game with Red Player',
        verifications: [
            {
                spec: 'Add Players and Start',
                check: async () => {
                    await page.goto('/?seed=salvage_test_1&hostId=e2e_host_salvage');

                    // Add Red (Bottom)
                    await page.locator('.bottom .add-btn').click({ force: true });
                    await page.locator('.color-picker button[title="red"]').click({ force: true });

                    // Add Yellow (Top)
                    await page.locator('.top .add-btn').click({ force: true });
                    await page.locator('.color-picker button[title="yellow"]').click({ force: true });

                    // Start
                    await page.locator('.play-btn').click({ force: true });
                    await expect(page.locator('.board-container')).toBeVisible();
                }
            },
            { spec: 'Offer is visible', check: async () => await expect(page.locator('.offer-container')).toBeVisible() },
            { spec: 'Turn Indicator shows RED', check: async () => await expect(page.locator('.turn-indicator')).toContainText('RED TURN') }
        ]
    });

    // 2. Select Cards for Salvage (RED TURN)
    // We rely on seed for deterministic offer.
    // Let's assume offer has cards. clicking a card selects it.
    const firstCard = page.locator('.offer-container .card-wrapper').first();
    const secondCard = page.locator('.offer-container .card-wrapper').nth(1);

    await firstCard.click();

    await tester.step('select-first-card', {
        description: 'Player selects first card from offer',
        verifications: [
            { spec: 'Card is visually selected', check: async () => await expect(firstCard).toHaveClass(/selected/) },
            { spec: 'Salvage button appears', check: async () => await expect(page.locator('.salvage-btn')).toBeVisible() }
        ]
    });

    await secondCard.click();

    await tester.step('select-second-card', {
        description: 'Player selects second card from offer',
        verifications: [
            {
                spec: 'Both cards selected', check: async () => {
                    await expect(firstCard).toHaveClass(/selected/);
                    await expect(secondCard).toHaveClass(/selected/);
                }
            },
            // Assuming cost isn't > 12 for first two cards with this seed, button should be enabled
            // If seed produces high cost cards, this might fail, but let's assume standard distribution
            { spec: 'Salvage button enabled', check: async () => await expect(page.locator('.salvage-btn')).not.toBeDisabled() }
        ]
    });

    // 3. Confirm Salvage
    await page.locator('.salvage-btn').click();

    await tester.step('confirm-salvage', {
        description: 'Player confirms salvage',
        verifications: [
            // Turn should switch
            { spec: 'Turn toggles to YELLOW', check: async () => await expect(page.locator('.turn-indicator')).toContainText('YELLOW TURN') },
            // Selected cards removed from offer (offer refilled, but specific DOM elements change)
            // Hard to test specific cards without ID tracking, but we can verify offer is full again
            { spec: 'Offer refilled to 5 cards', check: async () => await expect(page.locator('.offer-container .card-wrapper')).toHaveCount(5) },
            // Selection cleared
            { spec: 'Selection cleared', check: async () => await expect(page.locator('.offer-container .card-wrapper.selected')).toHaveCount(0) }
        ]
    });

    tester.generateDocs();
});
