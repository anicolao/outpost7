import { expect, test, type Browser, type Page, type TestInfo } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';

const GAME_ID = 'e2e_responsive_cards';

async function startGame(page: Page) {
    await page.goto(`/?seed=responsive_cards_001&gameId=${GAME_ID}`);
    await expect(page.locator('.lobby-container')).toBeVisible();
    await page.locator('.edge-control.bottom .add-btn').click();
    await page.locator('.edge-control.bottom .color-btn[title="red"]').click();
    await page.locator('.edge-control.top .add-btn').click();
    await page.locator('.edge-control.top .color-btn[title="yellow"]').click();
    await page.locator('.play-btn').click();
    await expect(page.locator('.board-container')).toBeVisible();
    await expect(page.locator('.table-top')).toHaveAttribute('data-transport-status', 'ready');
}

async function connectPhone(browser: Browser, hostPage: Page, testInfo: TestInfo) {
    const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    const helper = new TestStepHelper(page, testInfo, false);
    helper.setMetadata(
        'Responsive Card Layout',
        'Cards fill phone and tabletop displays without scrolling or resizing during movement.',
    );

    await page.goto(`/#/hand?game=${GAME_ID}&color=red`);
    await expect(page.locator('.status')).toHaveText('Connected');
    await expect(hostPage.locator('.qr-zone.bottom')).toBeHidden();
    return { context, page, helper };
}

async function selectValidPair(page: Page) {
    const pair = await page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll<HTMLElement>('.card-wrapper'));
        const costs = cards.map((card, index) => ({
            index,
            cost: Number(card.querySelector('.card-value')?.textContent ?? 0),
        }));

        for (const play of costs) {
            for (const pay of costs) {
                if (play.index !== pay.index && pay.cost >= play.cost) return { play: play.index, pay: pay.index };
            }
        }
        return null;
    });
    if (!pair) throw new Error('Expected a valid play/pay pair');

    const cards = page.locator('.card-wrapper');
    await cards.nth(pair.play).click();
    await expect(cards.nth(pair.play)).toHaveClass(/play-selected/);
    await cards.nth(pair.pay).click();
    await expect(cards.nth(pair.pay)).toHaveClass(/pay-selected/);
}

const dimensions = (rect: { width: number; height: number }) =>
    [Math.min(rect.width, rect.height), Math.max(rect.width, rect.height)];

test('cards maximize both phone and tabletop displays without resizing', async ({ page: hostPage, browser }, testInfo) => {
    const hostHelper = new TestStepHelper(hostPage, testInfo);
    hostHelper.setMetadata(
        'Responsive Card Layout',
        'Cards fill phone and tabletop displays without scrolling or resizing during movement.',
    );

    await startGame(hostPage);
    const phone = await connectPhone(browser, hostPage, testInfo);

    await hostPage.evaluate(() => {
        // @ts-ignore exposed by the E2E app
        window.store.dispatch({ type: 'game/dealCards', payload: { count: 2, to: 'red' } });
    });
    await expect(phone.page.locator('.card-wrapper')).toHaveCount(7);

    await phone.helper.step('phone-hand-fills-viewport', {
        description: 'Seven-card hand fills a phone viewport',
        verifications: [
            {
                spec: 'The phone page and card area have no horizontal or vertical scrolling',
                check: async () => {
                    const overflow = await phone.page.evaluate(() => {
                        const list = document.querySelector<HTMLElement>('.card-list')!;
                        return {
                            documentX: document.documentElement.scrollWidth - window.innerWidth,
                            documentY: document.documentElement.scrollHeight - window.innerHeight,
                            listX: list.scrollWidth - list.clientWidth,
                            listY: list.scrollHeight - list.clientHeight,
                        };
                    });
                    expect(overflow).toEqual({ documentX: 0, documentY: 0, listX: 0, listY: 0 });
                },
            },
            {
                spec: 'Every card is fully visible and at least 100 CSS pixels wide',
                check: async () => {
                    const cards = await phone.page.locator('.card-wrapper').evaluateAll((elements) =>
                        elements.map((element) => {
                            const rect = element.getBoundingClientRect();
                            return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width };
                        }),
                    );
                    for (const card of cards) {
                        expect(card.left).toBeGreaterThanOrEqual(0);
                        expect(card.top).toBeGreaterThanOrEqual(0);
                        expect(card.right).toBeLessThanOrEqual(390);
                        expect(card.bottom).toBeLessThanOrEqual(844);
                        expect(card.width).toBeGreaterThanOrEqual(100);
                    }
                },
            },
        ],
    });

    const simulatedIOSInset = 54;
    await phone.page.evaluate((inset) => {
        document.documentElement.style.setProperty('--simulated-safe-area-inset-bottom', `${inset}px`);
    }, simulatedIOSInset);
    await phone.helper.step('phone-actions-clear-ios-safe-area', {
        description: 'Phone actions stay above iOS browser controls',
        verifications: [
            {
                spec: 'Every action button is fully above the simulated iOS bottom inset',
                check: async () => {
                    const geometry = await phone.page.evaluate((inset) => {
                        const footer = document.querySelector<HTMLElement>('footer.actions')!.getBoundingClientRect();
                        const buttons = Array.from(document.querySelectorAll<HTMLElement>('footer.actions button'))
                            .map((button) => button.getBoundingClientRect())
                            .map(({ top, bottom }) => ({ top, bottom }));
                        return {
                            usableBottom: window.innerHeight - inset,
                            footer: { top: footer.top, bottom: footer.bottom },
                            buttons,
                        };
                    }, simulatedIOSInset);

                    expect(geometry.footer.top).toBeGreaterThanOrEqual(0);
                    expect(geometry.footer.bottom).toBeLessThanOrEqual(geometry.usableBottom);
                    expect(geometry.buttons.length).toBeGreaterThan(0);
                    for (const button of geometry.buttons) {
                        expect(button.top).toBeGreaterThanOrEqual(0);
                        expect(button.bottom).toBeLessThanOrEqual(geometry.usableBottom);
                    }
                },
            },
            {
                spec: 'Reserving the iOS safe area does not introduce page or card scrolling',
                check: async () => {
                    const overflow = await phone.page.evaluate(() => {
                        const list = document.querySelector<HTMLElement>('.card-list')!;
                        return {
                            documentX: document.documentElement.scrollWidth - window.innerWidth,
                            documentY: document.documentElement.scrollHeight - window.innerHeight,
                            listX: list.scrollWidth - list.clientWidth,
                            listY: list.scrollHeight - list.clientHeight,
                        };
                    });
                    expect(overflow).toEqual({ documentX: 0, documentY: 0, listX: 0, listY: 0 });
                },
            },
        ],
    });
    await phone.page.evaluate(() => {
        document.documentElement.style.removeProperty('--simulated-safe-area-inset-bottom');
    });

    await phone.page.setViewportSize({ width: 844, height: 390 });
    await phone.helper.step('phone-landscape-fills-viewport', {
        description: 'Seven-card hand fills a landscape phone viewport',
        verifications: [
            {
                spec: 'The landscape phone page and card area have no scrolling',
                check: async () => {
                    const overflow = await phone.page.evaluate(() => {
                        const list = document.querySelector<HTMLElement>('.card-list')!;
                        return {
                            documentX: document.documentElement.scrollWidth - window.innerWidth,
                            documentY: document.documentElement.scrollHeight - window.innerHeight,
                            listX: list.scrollWidth - list.clientWidth,
                            listY: list.scrollHeight - list.clientHeight,
                        };
                    });
                    expect(overflow).toEqual({ documentX: 0, documentY: 0, listX: 0, listY: 0 });
                },
            },
            {
                spec: 'All seven cards remain fully visible and at least 100 CSS pixels wide',
                check: async () => {
                    const cards = await phone.page.locator('.card-wrapper').evaluateAll((elements) =>
                        elements.map((element) => {
                            const rect = element.getBoundingClientRect();
                            return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width };
                        }),
                    );
                    for (const card of cards) {
                        expect(card.left).toBeGreaterThanOrEqual(0);
                        expect(card.top).toBeGreaterThanOrEqual(0);
                        expect(card.right).toBeLessThanOrEqual(844);
                        expect(card.bottom).toBeLessThanOrEqual(390);
                        expect(card.width).toBeGreaterThanOrEqual(100);
                    }
                },
            },
        ],
    });
    await phone.page.setViewportSize({ width: 390, height: 844 });

    const discardButton = phone.page.locator('.discard-btn');
    const cardsByCost = await phone.page.locator('.card-wrapper').evaluateAll((elements) =>
        elements
            .map((element, index) => ({
                index,
                cost: Number(element.querySelector('.card-value')?.textContent ?? 0),
            }))
            .sort((left, right) => right.cost - left.cost),
    );
    for (const card of cardsByCost) {
        if (!(await discardButton.isDisabled())) break;
        await phone.page.locator('.card-wrapper').nth(card.index).click();
    }
    await expect(discardButton).toBeEnabled();
    await discardButton.click();
    await expect(phone.page.locator('.alert-banner')).toBeHidden();

    await selectValidPair(phone.page);
    const sourceCard = hostPage.locator('.face-down-card.bottom');
    await expect(sourceCard).toBeVisible();
    const sourceRect = await sourceCard.boundingBox();
    if (!sourceRect) throw new Error('Expected face-down source geometry');

    await hostPage.evaluate(() => {
        // Exercise the production animation path and restore normal animation CSS.
        // @ts-ignore E2E test flag
        window.E2E_TEST = false;
        document.querySelectorAll('style').forEach((style) => {
            if (style.textContent?.includes('transition-property: none')) style.remove();
        });
    });

    await hostPage.locator('[data-cell-id="0-0"]').click();
    const flyingCard = hostPage.locator('.flying-card');
    await expect(flyingCard).toBeVisible();
    const flight = await hostPage.evaluate(() => {
        const card = document.querySelector<HTMLElement>('.flying-card')!;
        const animation = card.getAnimations().find((candidate) =>
            candidate.effect?.getKeyframes().some((frame) => Boolean(frame.transform)),
        );
        const duration = animation?.effect?.getTiming().duration;
        if (!animation || typeof duration !== 'number') {
            throw new Error('Expected a finite card-flight transform animation');
        }
        animation.pause();
        const sample = (progress: number) => {
            animation.currentTime = duration * progress;
            const rect = card.getBoundingClientRect();
            const matrix = new DOMMatrix(getComputedStyle(card).transform);
            return {
                width: rect.width,
                height: rect.height,
                centerX: rect.left + rect.width / 2,
                centerY: rect.top + rect.height / 2,
                angle: Math.atan2(matrix.b, matrix.a) * 180 / Math.PI,
            };
        };
        const start = sample(0);
        const rotating = sample(0.175);
        const oriented = sample(0.35);
        const flying = sample(0.7);
        for (const activeAnimation of card.getAnimations({ subtree: true })) activeAnimation.finish();
        return { start, rotating, oriented, flying };
    });

    expect(dimensions(flight.oriented)[0]).toBeCloseTo(dimensions(sourceRect)[0], 0);
    expect(dimensions(flight.oriented)[1]).toBeCloseTo(dimensions(sourceRect)[1], 0);
    expect(Math.abs(flight.start.angle)).toBeLessThan(1);
    expect(Math.abs(flight.rotating.angle)).toBeGreaterThan(20);
    expect(Math.abs(flight.rotating.angle)).toBeLessThan(70);
    expect(Math.abs(flight.oriented.angle)).toBeCloseTo(90, 0);
    expect(Math.hypot(
        flight.start.centerX - flight.oriented.centerX,
        flight.start.centerY - flight.oriented.centerY,
    )).toBeLessThan(1);
    expect(Math.hypot(
        flight.oriented.centerX - flight.flying.centerX,
        flight.oriented.centerY - flight.flying.centerY,
    )).toBeGreaterThan(20);

    const playedCard = hostPage.locator('[data-cell-id="0-0"] .played-card .card-preview');
    await expect(playedCard).toBeVisible();

    await hostHelper.step('tabletop-cards-fill-viewport', {
        description: 'Tabletop, offer, and moving cards share one large size',
        verifications: [
            {
                spec: 'The placed card is at least 120 by 168 CSS pixels',
                check: async () => {
                    const box = await playedCard.boundingBox();
                    if (!box) throw new Error('Expected played card geometry');
                    const [shortSide, longSide] = dimensions(box);
                    expect(shortSide).toBeGreaterThanOrEqual(120);
                    expect(longSide).toBeGreaterThanOrEqual(168);
                },
            },
            {
                spec: 'Offer cards exactly match placed board cards',
                check: async () => {
                    const boardBox = await playedCard.boundingBox();
                    const offerBox = await hostPage.locator('.offer-container .card-wrapper .card-preview').first().boundingBox();
                    if (!boardBox || !offerBox) throw new Error('Expected board and offer card geometry');
                    expect(dimensions(offerBox)[0]).toBeCloseTo(dimensions(boardBox)[0], 0);
                    expect(dimensions(offerBox)[1]).toBeCloseTo(dimensions(boardBox)[1], 0);
                },
            },
            {
                spec: 'The tabletop remains contained within the display',
                check: async () => {
                    const overflow = await hostPage.evaluate(() => ({
                        x: document.documentElement.scrollWidth - window.innerWidth,
                        y: document.documentElement.scrollHeight - window.innerHeight,
                    }));
                    expect(overflow).toEqual({ x: 0, y: 0 });
                },
            },
            {
                spec: 'Deck, discard, and both hidden hand counts remain visible beside the offer',
                check: async () => {
                    await expect(hostPage.locator('.game-count')).toHaveCount(4);
                    const offer = await hostPage.locator('.offer-container').boundingBox();
                    const counts = await hostPage.locator('.game-counts').boundingBox();
                    if (!offer || !counts) throw new Error('Expected offer count geometry');
                    expect(counts.x).toBeGreaterThanOrEqual(offer.x);
                    expect(counts.x + counts.width).toBeLessThanOrEqual(offer.x + offer.width);
                    expect(counts.y).toBeGreaterThanOrEqual(offer.y);
                    expect(counts.y + counts.height).toBeLessThanOrEqual(offer.y + offer.height);
                },
            },
        ],
    });

    phone.helper.generateDocs();
    hostHelper.generateDocs(true);
    await phone.context.close();
});
