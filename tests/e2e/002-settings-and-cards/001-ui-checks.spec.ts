import { test, expect } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';

test('User can view Settings and Cards', async ({ page }, testInfo) => {
    const tester = new TestStepHelper(page, testInfo);

    tester.setMetadata(
        'Settings and Cards UI',
        '**As a** player, **I want** to see game settings and the card library, **so that** I can reference rules and components.'
    );

    // 1. Initial Load
    await page.goto('/');
    await tester.step('main-screen', {
        description: 'Main Screen with Global Controls',
        verifications: [
            {
                spec: 'Settings button is visible',
                check: async () => await expect(page.locator('button[title="Settings"]')).toBeVisible()
            },
            {
                spec: 'Cards button is visible',
                check: async () => await expect(page.locator('button[title="View Cards"]')).toBeVisible()
            }
        ]
    });

    // 2. Open Settings
    await page.click('button[title="Settings"]');
    await tester.step('settings-modal', {
        description: 'Settings Modal Open',
        verifications: [
            {
                spec: 'Modal header is visible',
                check: async () => await expect(page.locator('.header h2')).toHaveText('Game Settings')
            },
            {
                spec: 'Settings values are displayed',
                check: async () => {
                    // Check for the description text defined in settings.ts
                    await expect(page.locator('text=Max cost of cards')).toBeVisible();
                    await expect(page.locator('.value', { hasText: '12' })).toBeVisible();
                }
            }
        ]
    });

    // 3. Close Settings
    await page.click('.close-btn');
    await tester.step('settings-closed', {
        description: 'Main Screen after Closing Settings',
        verifications: [
            {
                spec: 'Modal is hidden',
                check: async () => await expect(page.locator('.modal')).not.toBeVisible()
            }
        ]
    });

    // 4. Open Cards
    await page.click('button[title="View Cards"]');
    // Wait for cards to load if async
    await expect(page.locator('.card-grid')).toBeVisible();

    await tester.step('cards-modal', {
        description: 'Cards Modal Open',
        verifications: [
            {
                spec: 'Modal header is visible',
                check: async () => await expect(page.locator('.header h2')).toHaveText('Card Library')
            },
            {
                spec: 'Card grid is populated',
                check: async () => await expect(page.locator('.card-item').first()).toBeVisible()
            }
        ]
    });

    // 5. Close Cards
    await page.click('.close-btn'); // Note: if multiple close-btns exist (e.g. from previous modal in DOM?), might be ambiguous if not fully unmounted. Playwright strict mode checks this.
    // The first modal should be destroyed by `if showSettings` block in App.svelte when closed.
    // So only one close-button should be visible now.

    await tester.step('cards-closed', {
        description: 'Main Screen after Closing Cards',
        verifications: [
            {
                spec: 'Modal is hidden',
                check: async () => await expect(page.locator('.modal')).not.toBeVisible()
            }
        ]
    });

    tester.generateDocs();
});
