import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './tests/e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: 'html',
    // Store snapshots in "screenshots" directory next to test file
    snapshotPathTemplate: 'tests/e2e/{testFileDir}/screenshots/{arg}.png',
    expect: {
        timeout: 5000,
        toHaveScreenshot: {
            maxDiffPixelRatio: 0.05,
        },
    },
    use: {
        baseURL: 'http://localhost:5177',
        trace: 'on-first-retry',
        actionTimeout: 5000,
        navigationTimeout: 5000,
    },
    projects: [
        {
            name: 'chromium',
            use: {
                ...devices['Desktop Chrome'],
                deviceScaleFactor: 1,
                launchOptions: {
                    args: [
                        '--font-render-hinting=none',
                        '--disable-font-subpixel-positioning',
                        '--disable-lcd-text',
                        '--disable-skia-runtime-opts',
                        '--disable-system-font-check',
                        '--disable-features=FontAccess,WebRtcHideLocalIpsWithMdns',
                        '--force-device-scale-factor=1',
                        '--disable-accelerated-2d-canvas',
                        '--disable-gpu', // Use software rendering for consistency
                        '--use-gl=swiftshader',
                        '--disable-smooth-scrolling',
                        '--disable-partial-raster',
                    ],
                },
            },
        },
    ],
    webServer: {
        command: 'npm run dev -- --port 5177',
        port: 5177,
        reuseExistingServer: !process.env.CI,
    },
});
