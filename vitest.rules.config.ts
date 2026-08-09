import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['tests/rules/**/*.test.ts'],
        fileParallelism: false,
        testTimeout: 20_000,
    },
});
