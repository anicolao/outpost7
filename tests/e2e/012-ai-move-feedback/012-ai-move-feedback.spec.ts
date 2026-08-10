import { expect, test, type Page } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';

const AI_STAGE_EVENT = 'outpost7:continue-ai-stage';
const cardDimensions = (box: { width: number; height: number }) =>
    [Math.min(box.width, box.height), Math.max(box.width, box.height)];

async function startSoloGame(page: Page, gameId: string, startingHandSize = 5) {
    await page.goto(`/?seed=${gameId}&gameId=${gameId}`);
    await expect(page.locator('.lobby-container')).toBeVisible();

    await page.locator('.settings-btn.top-left').click();
    await page.locator('[data-setting-key="CUBES_PER_PLAY"] button', { hasText: '+' }).click();

    if (startingHandSize !== 5) {
        await page.getByRole('button', { name: 'Setup rules' }).click();
        const decreaseStartingHand = page.locator(
            '[data-setting-key="STARTING_HAND_SIZE"] button',
            { hasText: '-' },
        );
        for (let size = 5; size > startingHandSize; size--) await decreaseStartingHand.click();
        await expect(page.locator('[data-setting-key="STARTING_HAND_SIZE"] .value'))
            .toHaveText(String(startingHandSize));
    }

    await page.locator('.modal .close-btn').click();
    await page.locator('.edge-control.bottom .add-btn').click();
    await page.locator('.color-picker button[title="red"]').click();
    await page.locator('.play-btn').click();
    await expect(page.locator('.board-container')).toBeVisible();
}

async function dispatchHumanRepair(page: Page) {
    await page.evaluate(() => {
        // @ts-ignore exposed by the E2E app
        const store = window.store;
        const game = store.getState().game;
        const hand = game.hands.red;

        for (const playCard of hand) {
            for (const payCard of hand) {
                if (playCard.id === payCard.id || payCard.cost < playCard.cost) continue;
                store.dispatch({
                    type: 'game/playCard',
                    payload: {
                        color: 'red',
                        playCardId: playCard.id,
                        payCardId: payCard.id,
                        row: 2,
                        col: 2,
                    },
                });
                let safety = 0;
                while (store.getState().game.pendingBonuses.length > 0 && safety < 10) {
                    safety++;
                    for (const bonus of store.getState().game.pendingBonuses) {
                        store.dispatch({ type: 'game/resolveBonus', payload: { bonusId: bonus.id } });
                    }
                }
                return;
            }
        }

        throw new Error('Expected the human to have a valid repair pair');
    });
}

async function releaseAIStage(page: Page) {
    await page.evaluate((eventName) => window.dispatchEvent(new CustomEvent(eventName)), AI_STAGE_EVENT);
}

async function enableProductionAnimations(page: Page) {
    await page.evaluate(() => {
        document.querySelectorAll('style').forEach((style) => {
            if (style.textContent?.includes('transition-property: none')) style.remove();
        });
    });
}

async function longestAnimationMs(page: Page, selector: string) {
    return page.locator(selector).evaluateAll((elements) => Math.max(
        0,
        ...elements.flatMap((element) => element.getAnimations({ subtree: true }))
            .map((animation) => {
                const duration = animation.effect?.getTiming().duration;
                return typeof duration === 'number' ? duration : 0;
            }),
    ));
}

async function waitForHumanTurn(page: Page, condition: (game: any) => boolean) {
    await page.evaluate((conditionSource) => {
        // @ts-ignore exposed by the E2E app
        const store = window.store;
        const condition = Function('game', `return (${conditionSource})(game)`) as (game: any) => boolean;
        const signal = AbortSignal.timeout(2000);

        return new Promise<void>((resolve, reject) => {
            let unsubscribe = () => {};
            const finish = () => {
                signal.removeEventListener('abort', abort);
                unsubscribe();
                resolve();
            };
            const abort = () => {
                unsubscribe();
                reject(new Error('AI feedback sequence did not finish within 2000ms'));
            };
            const check = () => {
                const game = store.getState().game;
                if (game.currentTurn === 'red' && game.pendingBonuses.length === 0 && condition(game)) finish();
            };

            signal.addEventListener('abort', abort, { once: true });
            unsubscribe = store.subscribe(check);
            check();
        });
    }, condition.toString());
}

test('AI repairs and salvages with clear staged feedback', async ({ page }, testInfo) => {
    await page.addInitScript(() => {
        // @ts-ignore test-only visual checkpoints consumed by Board
        window.E2E_AI_STAGE_HOLDS = [
            'repair-selection',
            'repair-flight',
            'salvage-selection:1',
            'salvage-flight',
        ];
    });

    const helper = new TestStepHelper(page, testInfo);
    helper.setMetadata(
        'AI Move Feedback',
        'Slow, staged tabletop animations make the AI’s repair and salvage choices obvious to a human player.',
    );
    let repairCardSize: number[] = [];
    let salvageCardSize: number[] = [];

    await startSoloGame(page, 'e2e_ai_repair_feedback');
    await dispatchHumanRepair(page);

    await expect(page.locator('.ai-action-feedback[data-stage="repair-selection"]')).toBeVisible();
    await enableProductionAnimations(page);
    await helper.step('ai-repair-choice', {
        description: 'The AI reveals the cards chosen for its repair',
        verifications: [
            {
                spec: 'The AI identifies its played and payment cards before moving',
                check: async () => {
                    await expect(page.locator('.ai-repair-choice .choice-card')).toHaveCount(2);
                    await expect(page.locator('.ai-repair-choice')).toContainText('PLAY');
                    await expect(page.locator('.ai-repair-choice')).toContainText('PAY');
                    expect(await longestAnimationMs(page, '.ai-repair-choice')).toBeGreaterThanOrEqual(1200);
                    const choiceBox = await page.locator('.ai-repair-choice .play-choice .choice-card').boundingBox();
                    if (!choiceBox) throw new Error('Expected repair-choice card geometry');
                    repairCardSize = cardDimensions(choiceBox);
                    expect(await page.locator('.played-card').count()).toBe(1);
                },
            },
        ],
    });

    await releaseAIStage(page);
    await expect(page.locator('.ai-action-feedback[data-stage="repair-flight"]')).toBeVisible();
    await helper.step('ai-repair-flight', {
        description: 'The AI moves its played card onto the tabletop',
        verifications: [
            {
                spec: 'A full-size card visibly travels to the chosen board cell',
                check: async () => {
                    await expect(page.locator('.flying-card.ai-controlled')).toBeVisible();
                    await expect(page.locator('.ai-action-label')).toContainText('PLAYS');
                    expect(await longestAnimationMs(page, '.flying-card.ai-controlled')).toBeGreaterThanOrEqual(1600);
                    const flyingBox = await page.locator('.flying-card.ai-controlled').boundingBox();
                    if (!flyingBox) throw new Error('Expected AI repair-flight geometry');
                    const flyingSize = cardDimensions(flyingBox);
                    expect(flyingSize[0]).toBeCloseTo(repairCardSize[0], 2);
                    expect(flyingSize[1]).toBeCloseTo(repairCardSize[1], 2);
                    expect(await page.locator('.played-card').count()).toBe(1);
                },
            },
        ],
    });

    await releaseAIStage(page);
    await waitForHumanTurn(page, (game) => game.grid.flat().filter(Boolean).length === 2);

    await startSoloGame(page, 'e2e_ai_salvage_feedback', 1);
    await page.evaluate(() => {
        // @ts-ignore exposed by the E2E app
        const store = window.store;
        const game = store.getState().game;
        store.dispatch({
            type: 'game/salvage',
            payload: { color: 'red', cardIds: [game.offer[0].id] },
        });
    });

    await expect(page.locator('.ai-action-feedback[data-stage="salvage-selection"]')).toBeVisible();
    await enableProductionAnimations(page);
    await helper.step('ai-salvage-choice', {
        description: 'The AI marks cards it selects from the offer',
        verifications: [
            {
                spec: 'The currently selected offer card glows in the AI colour',
                check: async () => {
                    await expect(page.locator('.offer-container .card-wrapper.ai-selected')).toHaveCount(1);
                    await expect(page.locator('.ai-action-label')).toContainText('SELECTS TO SALVAGE');
                    expect(await longestAnimationMs(page, '.offer-container .card-wrapper.ai-selected'))
                        .toBeGreaterThanOrEqual(1100);
                    const selectedBox = await page.locator('.offer-container .card-wrapper.ai-selected').boundingBox();
                    if (!selectedBox) throw new Error('Expected selected salvage-card geometry');
                    salvageCardSize = cardDimensions(selectedBox);
                    expect(await page.evaluate(() => {
                        // @ts-ignore exposed by the E2E app
                        return window.store.getState().game.hands.yellow.length;
                    })).toBe(1);
                },
            },
        ],
    });

    await releaseAIStage(page);
    await expect(page.locator('.ai-action-feedback[data-stage="salvage-flight"]')).toBeVisible();
    await helper.step('ai-salvage-flight', {
        description: 'The selected offer cards travel toward the AI',
        verifications: [
            {
                spec: 'Every salvaged card remains full-size while moving to the AI edge',
                check: async () => {
                    await expect(page.locator('.ai-salvage-card')).not.toHaveCount(0);
                    await expect(page.locator('.ai-action-label')).toContainText('SALVAGES');
                    expect(await longestAnimationMs(page, '.ai-salvage-card'))
                        .toBeGreaterThanOrEqual(1600);
                    const flyingBox = await page.locator('.ai-salvage-card').first().boundingBox();
                    if (!flyingBox) throw new Error('Expected AI salvage-flight geometry');
                    const flyingSize = cardDimensions(flyingBox);
                    expect(flyingSize[0]).toBeCloseTo(salvageCardSize[0], 2);
                    expect(flyingSize[1]).toBeCloseTo(salvageCardSize[1], 2);
                    expect(await page.evaluate(() => {
                        // @ts-ignore exposed by the E2E app
                        return window.store.getState().game.hands.yellow.length;
                    })).toBe(1);
                },
            },
        ],
    });

    await releaseAIStage(page);
    await waitForHumanTurn(page, (game) => game.hands.yellow.length > 1);
    helper.generateDocs();
});
