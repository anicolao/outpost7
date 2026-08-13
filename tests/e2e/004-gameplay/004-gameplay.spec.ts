import { test, expect, type Page } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';

test.describe('Gameplay Loop', () => {
    test('Gameplay Loop', async ({ page }) => {
        // Set E2E Flag to skip animations
        await page.addInitScript(() => {
            // @ts-ignore
            window.E2E_TEST = true;
        });

        const helper = new TestStepHelper(page, test.info());
        helper.setMetadata('Gameplay Loop', 'Verify full gameplay cycle: Selection -> Visuals -> Placement -> Interactive Bonus');

        // Debug Host Logs
        page.on('console', msg => console.log('HOST LOG:', msg.text()));

        // 1. Host - Start Game
        await helper.step('001-setup-host', {
            description: 'Start Game with Red Player',
            verifications: [
                {
                    spec: 'Add Red Player and Start',
                    check: async () => {
                        await page.goto('/?seed=e2e_test&gameId=e2e_host_gameplay');
                        await page.locator('.bottom .add-btn').click({ force: true });
                        await page.locator('.color-picker button[title="red"]').click({ force: true });
                        await expect(page.locator('.edge-control.bottom .player-token')).toBeVisible();

                        // Add Yellow too for valid game start requirements if any
                        await page.locator('.top .add-btn').click({ force: true });
                        await page.locator('.color-picker button[title="yellow"]').click({ force: true });

                        await page.locator('.play-btn').click({ force: true });
                        await expect(page.locator('.board-container')).toBeVisible();
                        const counts = await page.evaluate(() => {
                            // @ts-ignore exposed by the E2E app
                            const game = window.store.getState().game;
                            return {
                                deck: game.deck.length,
                                discard: game.discard.length,
                                red: game.hands.red.length,
                                yellow: game.hands.yellow.length,
                            };
                        });
                        for (const [pile, count] of Object.entries(counts)) {
                            await expect(page.locator(
                                `.game-count[data-pile="${pile}"] .count-value`,
                            )).toHaveText(String(count));
                        }
                    }
                }
            ]
        });

        // 2. Client - Connect Red
        let redPage: Page = null as any;
        await helper.step('002-connect-red', {
            description: 'Connect Red Player via QR',
            verifications: [
                {
                    spec: 'Open Red Client',
                    check: async () => {
                        const qrItem = page.locator('.qr-zone.bottom .qr-item');
                        await expect(qrItem).toBeVisible();

                        console.log('Attempting to click QR code for popup...');
                        const [popup] = await Promise.all([
                            page.waitForEvent('popup', { timeout: 2000 }),
                            qrItem.click() // Removing force: true to ensure it's actually clickable/visible
                        ]);

                        console.log('Popup detected.');
                        redPage = popup;

                        await expect(redPage.locator('.status')).toHaveText('Connected');
                        await expect(redPage.locator('.card-wrapper')).toHaveCount(5); // Initial deal

                        // Ensure Host recognizes connection (hiding QR) before snapshot
                        await expect(page.locator('.qr-zone.bottom')).toBeHidden();
                    }
                }
            ]
        });

        // 2.5 Client - Handle Initial Discard (if over limit)
        await helper.step('002_5-initial-discard', {
            description: 'Red Player Discards if Over Limit',
            page: redPage, // Use Client Page for screenshot
            verifications: [
                {
                    spec: 'Discard down to limit',
                    check: async () => {
                        // Check if alert banner exists
                        const alert = redPage.locator('.alert-banner');
                        if (await alert.isVisible()) {
                            console.log('Hand Limit Exceeded - Discarding...');
                            await expect(redPage.locator('.mode-switch')).toHaveCount(0);
                            const cards = redPage.locator('.card-wrapper');
                            const confirmBtn = redPage.locator('.discard-btn');

                            // Select cards until Confirm is enabled
                            let i = 0;
                            let selectedCount = 0;
                            while (await confirmBtn.isDisabled() && i < 5) {
                                console.log(`Selecting card ${i} for discard...`);
                                await cards.nth(i).click({ force: true });
                                selectedCount++;
                                await expect(cards.nth(i)).toHaveClass(/selected/);
                                i++;
                            }
                            console.log(`Selected ${selectedCount} cards. Enable state: ${!(await confirmBtn.isDisabled())}`);
                            await confirmBtn.click({ force: true });
                            await expect(alert).toBeHidden();
                            await expect(redPage.locator('.mode-switch')).toHaveCount(0);
                            console.log('Discard complete.');
                        } else {
                            console.log('Hand Limit OK.');
                        }
                    }
                }
            ]
        });

        // 3. Client - Select Play/Pay
        await helper.step('003-client-selection', {
            description: 'Red Player Selects Play and Pay Cards',
            page: redPage, // Use Client Page for screenshot
            verifications: [
                {
                    spec: 'Select Valid Play/Pay pair',
                    check: async () => {
                        // Smart Selection Logic: Find a valid pair (Pay >= Play)
                        await expect(redPage.locator('.card-wrapper').nth(1)).toBeVisible();
                        const indices = await redPage.evaluate(() => {
                            const cards = Array.from(document.querySelectorAll('.card-wrapper'));
                            const cardData = cards.map((el, index) => {
                                const valueText = el.querySelector('.card-value')?.textContent || '0';
                                return { index, cost: parseInt(valueText, 10) };
                            });

                            for (let i = 0; i < cardData.length; i++) {
                                for (let j = 0; j < cardData.length; j++) {
                                    if (i === j) continue;
                                    if (cardData[j].cost >= cardData[i].cost) {
                                        return { playIndex: i, payIndex: j, playCost: cardData[i].cost, payCost: cardData[j].cost };
                                    }
                                }
                            }
                            return null;
                        });

                        if (!indices) {
                            throw new Error('No valid Play/Pay pair found in hand!');
                        }

                        console.log(`Test Selection: Play Index ${indices.playIndex} (Cost ${indices.playCost}), Pay Index ${indices.payIndex} (Cost ${indices.payCost})`);

                        const cards = redPage.locator('.card-wrapper');
                        await cards.nth(indices.playIndex).click({ force: true });
                        console.log('Clicked Play Card');

                        await cards.nth(indices.payIndex).click({ force: true });
                        console.log('Clicked Pay Card');
                    }
                }
            ]
        });

        // 4. Host - Verify Visual Feedback
        await helper.step('004-host-feedback', {
            description: 'Verify Face Down Card and Highlights',
            verifications: [
                {
                    spec: 'Face down card visible at bottom',
                    check: async () => {
                        await expect(page.locator('.face-down-card.bottom')).toBeVisible();
                    }
                },
                {
                    spec: 'Every cell is a legal first placement with a static glow',
                    check: async () => {
                        await expect(page.locator('.cell.valid')).toHaveCount(25);
                        await page.evaluate(() => {
                            document.querySelectorAll('style').forEach((style) => {
                                if (style.textContent?.includes('transition-property: none')) style.remove();
                            });
                        });
                        const animationName = await page.locator('.cell.valid').first()
                            .evaluate((cell) => getComputedStyle(cell).animationName);
                        expect(animationName).toBe('none');
                    }
                }
            ]
        });

        // 5. Host - Execute Move
        await helper.step('005-execute-move', {
            description: 'Click cell to place card',
            verifications: [
                {
                    spec: 'Click target cell (2,2)',
                    check: async () => {
                        const target = page.locator('[data-cell-id="2-2"]');
                        await target.click();
                    }
                },
                {
                    spec: 'Wait for animation and placement',
                    check: async () => {
                        // Verify cell has the card content (CardDisplay)
                        const cell = page.locator('[data-cell-id="2-2"]');

                        await expect(cell.locator('.card-bg')).toBeVisible();

                        console.log('Verified Card Rendered (CardDisplay)');

                        // Wait for update - Should enter BONUS ACTIONS or YELLOW TURN
                        await expect(page.locator('.turn-indicator')).toHaveText(/BONUS ACTIONS|YELLOW TURN/);
                    }
                },
                {
                    spec: 'Public deck, discard, and hand counts update after the repair',
                    check: async () => {
                        const counts = await page.evaluate(() => {
                            // @ts-ignore exposed by the E2E app
                            const game = window.store.getState().game;
                            return {
                                deck: game.deck.length,
                                discard: game.discard.length,
                                red: game.hands.red.length,
                                yellow: game.hands.yellow.length,
                            };
                        });
                        for (const [pile, count] of Object.entries(counts)) {
                            await expect(page.locator(
                                `.game-count[data-pile="${pile}"] .count-value`,
                            )).toHaveText(String(count));
                        }
                    },
                }
            ]
        });

        // 6. Host - Handle Interactive Bonus
        await helper.step('006-resolve-bonus', {
            description: 'Resolve Bonus Phase if Active',
            verifications: [
                {
                    spec: 'Check and Resolve Bonus',
                    check: async () => {
                        const text = await page.locator('.turn-indicator').innerText();
                        if (text === 'BONUS ACTIONS') {
                            console.log('Bonus Actions Active - Resolving...');

                            // Find the interactive cube on the first station card
                            const cell = page.locator('[data-cell-id="2-2"]');
                            const interactiveCube = cell.locator('.player-cube.interactive');

                            await expect(interactiveCube).toBeVisible();
                            console.log('Found interactive cube');

                            // Click it
                            await interactiveCube.click();

                            await expect(interactiveCube).toBeHidden();
                        } else {
                            console.log('No Bonus Phase triggered.');
                        }
                    }
                },
                {
                    spec: 'Verify Final Turn State (Yellow)',
                    check: async () => {
                        await expect(page.locator('.turn-indicator')).toHaveText('YELLOW TURN');
                    }
                }
            ]
        });

        await page.evaluate(() => {
            // Give the connected player a fresh hand, then return the turn to it.
            // @ts-ignore exposed by the E2E app
            const store = window.store;
            store.dispatch({ type: 'game/dealCards', payload: { count: 5, to: 'red' } });
            store.dispatch({ type: 'game/passTurn', payload: { color: 'yellow' } });
        });
        await expect(redPage.locator('.turn-stat')).toHaveText('YOUR TURN');

        await helper.step('007-select-red-repair', {
            description: 'Red selects cards for the next repair',
            page: redPage,
            verifications: [
                {
                    spec: 'Select a legal play and payment pair',
                    check: async () => {
                        await expect(redPage.locator('.alert-banner')).toHaveCount(0);

                        const cards = redPage.locator('.card-wrapper');
                        const cardStates = await cards.evaluateAll((elements) => elements.map((card, index) => ({
                            index,
                            disabled: card.classList.contains('disabled'),
                            cost: Number(card.querySelector('.card-value')?.textContent),
                        })));
                        const playCard = cardStates
                            .filter(card => !card.disabled && cardStates.some(other => other.cost < card.cost))
                            .sort((left, right) => right.cost - left.cost)[0];
                        expect(playCard, 'Expected a playable card with a lower-cost card to disable').toBeTruthy();
                        await cards.nth(playCard.index).click();
                        const payCard = redPage.locator(
                            '.card-wrapper:not(.disabled):not(.play-selected)',
                        ).first();
                        await payCard.click();
                        await expect(page.locator('.face-down-card.bottom')).toBeVisible();
                    },
                },
                {
                    spec: 'Unavailable cards are dimmed without losing their colour',
                    check: async () => {
                        const disabledCards = redPage.locator('.card-wrapper.disabled');
                        await expect(disabledCards).not.toHaveCount(0);
                        const disabledTreatment = await disabledCards.first().evaluate((card) => ({
                            filter: getComputedStyle(card).filter,
                            opacity: getComputedStyle(card).opacity,
                            resourceFilter: getComputedStyle(
                                card.querySelector('.resource-icon') as HTMLElement,
                            ).filter,
                        }));
                        expect(disabledTreatment).toEqual({
                            filter: 'none',
                            opacity: '0.55',
                            resourceFilter: 'none',
                        });
                        await expect(disabledCards.first().locator('.unavailable-overlay'))
                            .toHaveCount(0);
                    },
                },
            ],
        });

        await helper.step('008-adjacent-placements', {
            description: 'Only spaces next to the station are legal',
            verifications: [
                {
                    spec: 'Only the four orthogonally adjacent cells have a static glow',
                    check: async () => {
                        await expect(page.locator('.cell.valid')).toHaveCount(4);
                        const legalCellIds = await page.locator('.cell.valid').evaluateAll((cells) =>
                            cells.map((cell) => cell.getAttribute('data-cell-id')),
                        );
                        expect(legalCellIds).toEqual(['1-2', '2-1', '2-3', '3-2']);
                    },
                },
                {
                    spec: 'A distant or diagonal space rejects the card',
                    check: async () => {
                        await page.locator('[data-cell-id="0-0"]').click();
                        await expect(page.locator('[data-cell-id="0-0"] .played-card')).toHaveCount(0);
                    },
                },
            ],
        });

        await helper.step('009-adjacent-placement-accepted', {
            description: 'A card can be placed next to the station',
            verifications: [
                {
                    spec: 'An adjacent space accepts the card',
                    check: async () => {
                        await page.locator('[data-cell-id="2-3"]').click();
                        await expect(page.locator('[data-cell-id="2-3"] .played-card')).toBeVisible();
                    },
                },
            ],
        });

        helper.generateDocs();
    });
});
