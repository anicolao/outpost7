import seedrandom from 'seedrandom';

export type RandomSource = () => number;

export function createSeededRandom(seed: string, stream?: string): RandomSource {
    return seedrandom(stream ? `${seed}:${stream}` : seed);
}

export function getGameSeed(
    search: string,
    generateSeed: () => string = () => crypto.randomUUID(),
): string {
    return new URLSearchParams(search).get('seed') || generateSeed();
}
