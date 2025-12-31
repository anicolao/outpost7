import { type Page, type TestInfo, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

export interface Verification {
    spec: string;
    check: () => Promise<void>;
}

export interface StepOptions {
    description: string;
    verifications: Verification[];
    page?: Page; // Optional override for multi-page tests
    skipScreenshot?: boolean;
}

// Shared Utility
export async function waitForAnimations(page: Page) {
    await page.evaluate(async () => {
        let stableFrames = 0;
        // Wait for 2 consecutive frames with no active animations to ensure steady state.
        // This catches cases where animations start a few frames after DOM insertion.
        const requiredStableFrames = 2;

        while (stableFrames < requiredStableFrames) {
            const animations = document.getAnimations().filter(a => {
                if (a.playState === 'finished') return false;
                // Ignore infinite animations
                const timing = a.effect && a.effect.getTiming();
                if (timing && timing.iterations === Infinity) return false;
                return true;
            });

            if (animations.length > 0) {
                // If animations are running, wait for them to finish (or be cancelled)
                stableFrames = 0;
                // Animations might be cancelled (e.g. element removed), which rejects 'finished'.
                // We should catch that.
                await Promise.all(animations.map(a => a.finished.catch(() => { })));
            } else {
                // If quiet, count this frame
                stableFrames++;
                await new Promise(resolve => requestAnimationFrame(resolve));
            }
        }
    });
}

interface DocStep {
    title: string;
    image: string;
    specs: string[];
}

export class TestStepHelper {
    private stepCount = 0;
    private steps: DocStep[] = [];
    private metadata = { title: '', story: '' };

    constructor(private page: Page, private testInfo: TestInfo, clean = true) {
        const screenshotDir = path.join(path.dirname(this.testInfo.file), 'screenshots');

        // Ensure directory exists
        if (!fs.existsSync(screenshotDir)) {
            fs.mkdirSync(screenshotDir, { recursive: true });
        }

        // Strict Console Check (but filter out known benign errors)
        this.page.on('console', msg => {
            if (msg.type() === 'error') {
                const text = msg.text();
                // Filter out PeerJS connection errors which are expected in test environment
                if (text.includes('peerjs.com') || text.includes('ERR_NAME_NOT_RESOLVED')) {
                    console.log(`PAGE WARNING (filtered): ${text}`);
                    return;
                }
                console.error(`PAGE ERROR LOG: ${text}`);
                throw new Error(`Console Error Detected: ${text}`);
            }
        });
        this.page.on('pageerror', err => {
            console.error(`PAGE EXCEPTION: ${err.message}`);
            throw new Error(`Uncaught Exception: ${err.message}`);
        });

        this.page.on('requestfailed', request => {
            console.log(`FAILED REQUEST: ${request.url()} - ${request.failure()?.errorText}`);
        });

        this.page.on('response', response => {
            if (response.status() >= 400) {
                console.log(`BAD RESPONSE: ${response.url()} - ${response.status()}`);
            }
        });

        // Inject CSS to disable animations and cursors for pixel-perfect stability
        this.page.addInitScript(() => {
            const style = document.createElement('style');
            style.innerHTML = `
                *, *::before, *::after {
                    transition: none !important;
                    animation: none !important;
                    caret-color: transparent !important;
                }
            `;
            // @ts-ignore
            window.E2E_TEST = true;

            const target = document.head || document.documentElement;
            if (target) target.appendChild(style);
        });
    }

    setMetadata(title: string, story: string) {
        this.metadata = { title, story };
    }

    async step(id: string, options: StepOptions) {
        // 1. Run Verifications
        // Use the override page if provided, otherwise default helper page
        const targetPage = options.page || this.page;

        for (const v of options.verifications) {
            await v.check();
        }

        // 2. Generate Name
        const paddedIndex = String(this.stepCount++).padStart(3, '0');
        const filename = `${paddedIndex}-${id}`.replace(/_/g, '-'); // Sanitize for Playwright

        // 3. Capture
        // Ensure the screenshots directory exists relative to the test file
        const screenshotDir = path.join(path.dirname(this.testInfo.file), 'screenshots');
        if (!fs.existsSync(screenshotDir)) {
            fs.mkdirSync(screenshotDir, { recursive: true });
        }

        // Wait for animations on the TARGET page
        await waitForAnimations(targetPage);

        // Assert equality (Pixel Perfect)
        if (!options.skipScreenshot) {
            await expect(targetPage).toHaveScreenshot(filename);
        }

        // 4. Record for Docs
        this.steps.push({
            title: options.description,
            image: `screenshots/${filename}.png`,
            specs: options.verifications.map(v => v.spec)
        });
    }

    generateDocs(append = false) {
        const docPath = path.join(path.dirname(this.testInfo.file), 'README.md');
        let content = '';

        if (!append) {
            content += `# ${this.metadata.title}\n\n${this.metadata.story}\n\n`;
        } else if (fs.existsSync(docPath)) {
            content = fs.readFileSync(docPath, 'utf-8') + '\n\n';
        } else {
            content += `# ${this.metadata.title}\n\n${this.metadata.story}\n\n`;
        }

        for (const step of this.steps) {
            content += `## ${step.title}\n\n`;
            content += `![${step.title}](${step.image})\n\n`;
            content += `**Specs:**\n`;
            for (const spec of step.specs) {
                content += `- ${spec}\n`;
            }
            content += `\n`;
        }

        fs.writeFileSync(docPath, content);
    }
}
