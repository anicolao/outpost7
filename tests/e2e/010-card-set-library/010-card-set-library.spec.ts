import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { TestStepHelper } from '../helpers/test-step-helper';

function customCardSetTsv() {
    return readFileSync('public/cards.csv', 'utf8')
        .trim()
        .split('\n')
        .map((line, index) => {
            const values = line.split(',');
            if (index > 0 && values[1]?.includes('_module_')) values[3] = '1';
            return values.join('\t');
        })
        .join('\n');
}

async function openCardLibrary(page: Page) {
    await page.locator('.settings-btn.top-left').click();
    await expect(page.getByRole('heading', { name: 'Game Settings' })).toBeVisible();
    await page.getByRole('button', { name: 'Open Card Library...' }).click();
    await expect(page.getByRole('heading', { name: 'Card Library' })).toBeVisible();
}

test('upload, review, and play a persistent named card set', async ({ page }, testInfo) => {
    const helper = new TestStepHelper(page, testInfo);
    helper.setMetadata(
        'Persistent Card Set Library',
        'Upload a named TSV card set to Firebase, review it later, and choose it for the next game.',
    );

    await page.goto('/?seed=card_set_library&gameId=e2e_card_set_library');
    await expect(page.locator('.lobby-container')).toBeVisible();
    await openCardLibrary(page);

    await helper.step('bundled-card-set', {
        description: 'Review the bundled card set',
        verifications: [
            {
                spec: 'The bundled set is initially active and its cards are visible',
                check: async () => {
                    const bundled = page.locator('.card-set-option', { hasText: 'Bundled cards' });
                    await expect(bundled).toContainText('Active');
                    await expect(page.locator('.card-grid .card-item')).toHaveCount(73);
                },
            },
        ],
    });

    await page.getByRole('button', { name: 'Add card set' }).click();
    await page.getByLabel('Card set name').fill('v49');
    await page.getByLabel('Card set TSV').fill(customCardSetTsv());

    await helper.step('paste-card-set', {
        description: 'Paste a named TSV card set',
        verifications: [
            {
                spec: 'The importer accepts a name and pasted tab-separated card data',
                check: async () => {
                    await expect(page.getByLabel('Card set name')).toHaveValue('v49');
                    await expect(page.getByLabel('Card set TSV')).toHaveValue(/blue_module_3\.pdf/);
                },
            },
        ],
    });

    await page.getByRole('button', { name: 'Upload card set' }).click();
    await expect(page.locator('.card-set-option', { hasText: 'v49' })).toBeVisible();

    await helper.step('activate-uploaded-set', {
        description: 'Choose the uploaded set for play',
        verifications: [
            {
                spec: 'The uploaded set is stored with its name and complete card count',
                check: async () => {
                    const uploaded = page.locator('.card-set-option', { hasText: 'v49' });
                    await expect(uploaded).toContainText('73 cards');
                    await uploaded.getByRole('button', { name: 'Use this set' }).click();
                    await expect(uploaded).toContainText('Active');
                    await expect(page.locator('.card-grid .card-item')).toHaveCount(73);
                },
            },
        ],
    });

    await page.reload();
    await expect(page.locator('.lobby-container')).toBeVisible();
    await openCardLibrary(page);

    await helper.step('persistent-card-set', {
        description: 'Find the selected set after reloading',
        verifications: [
            {
                spec: 'Firebase retains the uploaded set and the device remembers it as active',
                check: async () => {
                    const uploaded = page.locator('.card-set-option', { hasText: 'v49' });
                    await expect(uploaded).toBeVisible();
                    await expect(uploaded).toContainText('Active');
                },
            },
        ],
    });

    await page.locator('.close-btn').click();
    const bottom = page.locator('.edge-control.bottom');
    await bottom.locator('.add-btn').click();
    await bottom.locator('button[title="red"]').click();
    const top = page.locator('.edge-control.top');
    await top.locator('.add-btn').click();
    await top.locator('button[title="yellow"]').click();
    await page.locator('.play-btn').click();

    await helper.step('play-selected-set', {
        description: 'Start a game with the selected card set',
        verifications: [
            {
                spec: 'The offer uses the uploaded v49 values instead of the bundled values',
                check: async () => {
                    await expect(page.locator('.board-container')).toBeVisible();
                    const costs = page.locator('.offer-container .card-value');
                    await expect(costs).toHaveCount(5);
                    await expect(costs).toHaveText(['1', '1', '1', '1', '1']);
                },
            },
        ],
    });

    helper.generateDocs();
});
