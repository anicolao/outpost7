export type BonusType = 'ADD_CUBE' | 'REMOVE_CUBE' | 'ADD_POPULATION';

export interface BonusDefinition {
    type: BonusType;
    color?: string; // For ADD_POPULATION
}

export interface CardData {
    index: string;
    background: string;
    module_resource_1: string;
    text_module_resource_1: string;
    cube_1: string;
    cube_2: string;
    cube_3: string;
    cube_4: string;
    cube_5: string;
    cube_6: string;
    // Derived properties
    cost: number;
    color: string;
    // Parsed Bonuses for each cube slot (1-6)
    bonuses: Record<number, BonusDefinition>;
    maxCubes: number;
}

function parseBonus(filename: string): BonusDefinition | null {
    if (!filename) return null;
    if (filename.includes('bonus_add_cube')) return { type: 'ADD_CUBE' };
    if (filename.includes('bonus_remove_cube')) return { type: 'REMOVE_CUBE' };
    const popMatch = filename.match(/bonus_([a-z]+)_pop/);
    if (popMatch) return { type: 'ADD_POPULATION', color: popMatch[1] };
    return null;
}

const REQUIRED_CARD_COLUMNS = [
    'index',
    'background',
    'module_resource_1',
    'text_module_resource_1',
    'cube_1',
    'cube_2',
    'cube_3',
    'cube_4',
    'cube_5',
    'cube_6',
];

export function parseCards(source: string): CardData[] {
    const normalizedSource = source.replace(/^\uFEFF/, '').trim();
    if (!normalizedSource) throw new Error('Paste a TSV or CSV card set.');

    const lines = normalizedSource.split(/\r?\n/);
    if (lines.length < 2) throw new Error('The card set must include a header and at least one card.');

    const delimiter = lines[0].includes('\t') ? '\t' : ',';
    const headers = lines[0].split(delimiter).map((header) => header.trim().replace(/^@/, ''));
    const missingHeaders = REQUIRED_CARD_COLUMNS.filter((header) => !headers.includes(header));
    if (missingHeaders.length > 0) {
        throw new Error(`Missing required columns: ${missingHeaders.join(', ')}`);
    }

    const cards: CardData[] = [];
    for (let lineIndex = 1; lineIndex < lines.length; lineIndex++) {
        if (!lines[lineIndex].trim()) continue;

        const values = lines[lineIndex].split(delimiter);
        const rawCard: Record<string, string> = {};
        headers.forEach((header, valueIndex) => {
            rawCard[header] = values[valueIndex]?.trim() ?? '';
        });

        if (!rawCard.background) throw new Error(`Row ${lineIndex + 1} is missing a background.`);

        const bonuses: Record<number, BonusDefinition> = {};
        let maxCubes = 0;
        for (let slot = 1; slot <= 6; slot++) {
            const value = rawCard[`cube_${slot}`];
            if (value) maxCubes++;
            const bonus = parseBonus(value);
            if (bonus) bonuses[slot] = bonus;
        }

        const resource = rawCard.module_resource_1 || '';
        const colorMatch = resource.match(/^([a-z]+)_/);
        cards.push({
            index: rawCard.index,
            background: rawCard.background,
            module_resource_1: rawCard.module_resource_1,
            text_module_resource_1: rawCard.text_module_resource_1,
            cube_1: rawCard.cube_1,
            cube_2: rawCard.cube_2,
            cube_3: rawCard.cube_3,
            cube_4: rawCard.cube_4,
            cube_5: rawCard.cube_5,
            cube_6: rawCard.cube_6,
            cost: Number.parseInt(rawCard.text_module_resource_1 || '0', 10),
            color: colorMatch ? colorMatch[1] : 'gray',
            bonuses,
            maxCubes,
        });
    }

    if (cards.length === 0) throw new Error('The card set must include at least one card.');
    return cards;
}

export async function loadCards(): Promise<CardData[]> {
    try {
        const baseUrl = import.meta.env.BASE_URL || '/';
        const url = baseUrl.endsWith('/') ? `${baseUrl}cards.csv` : `${baseUrl}/cards.csv`;

        const response = await fetch(url);
        if (!response.ok) {
            console.error(`Failed to load cards.csv from ${url}`);
            return [];
        }
        return parseCards(await response.text());
    } catch (e) {
        console.error("Error loading cards:", e);
        return [];
    }
}

export function getAssetUrl(filename: string): string {
    if (!filename || filename === '') return '';

    const baseUrl = import.meta.env.BASE_URL || '/';
    const prefix = baseUrl.endsWith('/') ? `${baseUrl}assets/` : `${baseUrl}/assets/`;

    // Input is like 'blue_module_3.pdf', output should be '/<base>/assets/blue_module_3.svg'
    return prefix + filename.replace('.pdf', '.svg');
}
