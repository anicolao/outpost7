import { type Page, type TestInfo } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

export interface Verification {
    spec: string;
    check: () => Promise<void>;
}

export interface StepOptions {
    description: string;
    verifications: Verification[];
}

// Shared Utility
export async function waitForAnimations(page: Page) {
    await page.evaluate(async () => {
        let stableFrames = 0;
        // Wait for 2 consecutive frames with no active animations to ensure steady state.
        // This catches cases where animations start a few frames after DOM insertion.
        const requiredStableFrames = 2;

        while (stableFrames < requiredStableFrames) {
            const animations = document.getAnimations().filter(a => a.playState !== 'finished');

            if (animations.length > 0) {
                // If animations are running, wait for them to finish
                stableFrames = 0;
                await Promise.all(animations.map(a => a.finished));
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

    constructor(private page: Page, private testInfo: TestInfo) {
        const screenshotDir = path.join(path.dirname(this.testInfo.file), 'screenshots');
        if (fs.existsSync(screenshotDir)) {
            fs.rmSync(screenshotDir, { recursive: true, force: true });
        }
    }

    setMetadata(title: string, story: string) {
        this.metadata = { title, story };
    }

    async step(id: string, options: StepOptions) {
        // 1. Run Verifications
        for (const v of options.verifications) {
            await v.check();
        }

        // 2. Generate Name
        const paddedIndex = String(this.stepCount++).padStart(3, '0');
        const filename = `${paddedIndex}-${id}.png`;

        // 3. Capture
        // Ensure the screenshots directory exists relative to the test file
        const screenshotDir = path.join(path.dirname(this.testInfo.file), 'screenshots');
        if (!fs.existsSync(screenshotDir)) {
            fs.mkdirSync(screenshotDir, { recursive: true });
        }
        await waitForAnimations(this.page);
        await this.page.screenshot({ path: path.join(screenshotDir, filename) });

        // 4. Record for Docs
        this.steps.push({
            title: options.description,
            image: `screenshots/${filename}`,
            specs: options.verifications.map(v => v.spec)
        });
    }

    generateDocs() {
        const docPath = path.join(path.dirname(this.testInfo.file), 'README.md');
        let content = `# ${this.metadata.title}\n\n${this.metadata.story}\n\n`;

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
