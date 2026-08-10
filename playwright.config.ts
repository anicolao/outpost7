import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './tests/e2e',
    fullyParallel: false,
    forbidOnly: !!process.env.CI,
    retries: 0,
    // Every spec uses a unique Firebase game ID, so files are safe to run concurrently.
    // Two workers keep Firebase and pixel capture below the hosted runner's contention point;
    // fullyParallel stays false to preserve ordering within documentation files.
    workers: process.env.CI ? 2 : undefined,
    reporter: 'html',
    // Store snapshots in "screenshots" directory next to test file
    snapshotPathTemplate: 'tests/e2e/{testFileDir}/screenshots/{arg}.png',
    expect: {
        timeout: 2000,
        toHaveScreenshot: {
            maxDiffPixels: 0,
        },
    },
    use: {
        baseURL: 'http://localhost:5177',
        trace: 'on-first-retry',
        actionTimeout: 2000,
        navigationTimeout: 2000,
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
                        '--disable-features=FontAccess',
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
        env: {
            VITE_FIREBASE_API_KEY: 'e2e-api-key',
            VITE_FIREBASE_AUTH_DOMAIN: 'outpost7-e2e.firebaseapp.com',
            VITE_FIREBASE_PROJECT_ID: 'outpost7-e2e',
            VITE_FIREBASE_STORAGE_BUCKET: 'outpost7-e2e.firebasestorage.app',
            VITE_FIREBASE_MESSAGING_SENDER_ID: '123456789',
            VITE_FIREBASE_APP_ID: '1:123456789:web:e2e',
            VITE_USE_FIREBASE_EMULATORS: 'true',
            VITE_FIRESTORE_EMULATOR_HOST: '127.0.0.1',
            VITE_FIRESTORE_EMULATOR_PORT: '8187',
            VITE_FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1',
            VITE_FIREBASE_AUTH_EMULATOR_PORT: '9201',
        },
    },
});
