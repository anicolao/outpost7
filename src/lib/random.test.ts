import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createSeededRandom, getGameSeed } from './random';

function sourceFiles(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) return sourceFiles(path);
        return entry.name.endsWith('.ts') || entry.name.endsWith('.svelte') ? [path] : [];
    });
}

describe('seeded randomness', () => {
    it('replays named random streams independently', () => {
        const sequence = (stream: string) => {
            const random = createSeededRandom('game-seed', stream);
            return Array.from({ length: 8 }, () => random());
        };

        expect(sequence('red')).toEqual(sequence('red'));
        expect(sequence('red')).not.toEqual(sequence('yellow'));
    });

    it('uses an explicit URL seed without generating another', () => {
        const generateSeed = vi.fn(() => 'generated-seed');

        expect(getGameSeed('?seed=provided-seed', generateSeed)).toBe('provided-seed');
        expect(generateSeed).not.toHaveBeenCalled();
    });

    it('generates a seed when the URL does not provide a usable one', () => {
        expect(getGameSeed('', () => 'generated-seed')).toBe('generated-seed');
        expect(getGameSeed('?seed=', () => 'generated-seed')).toBe('generated-seed');
    });

    it('keeps direct Math.random calls out of application code', () => {
        const srcRoot = join(process.cwd(), 'src');
        const violations = sourceFiles(srcRoot)
            .filter((file) => !file.endsWith('.test.ts'))
            .filter((file) => readFileSync(file, 'utf8').includes('Math.random'))
            .map((file) => relative(process.cwd(), file));

        expect(violations).toEqual([]);
    });
});
