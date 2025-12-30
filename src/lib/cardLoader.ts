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
}

function parseBonus(filename: string): BonusDefinition | null {
    if (!filename) return null;
    if (filename.includes('bonus_add_cube')) return { type: 'ADD_CUBE' };
    if (filename.includes('bonus_remove_cube')) return { type: 'REMOVE_CUBE' };
    const popMatch = filename.match(/bonus_([a-z]+)_pop/);
    if (popMatch) return { type: 'ADD_POPULATION', color: popMatch[1] };
    return null;
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
        const text = await response.text();
        const lines = text.trim().split('\n');
        if (lines.length < 2) return [];

        const headers = lines[0].split(',').map(h => h.trim().replace('@', ''));

        const cards: CardData[] = [];

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',');
            if (values.length < 2) continue;

            const card: any = {};
            headers.forEach((header, index) => {
                card[header] = values[index]?.trim();
            });

            // Derive Cost
            card.cost = parseInt(card.text_module_resource_1 || '0', 10);

            // Derive Color
            const resource = card.module_resource_1 || '';
            const match = resource.match(/^([a-z]+)_/);
            card.color = match ? match[1] : 'gray';

            // Parse Bonuses
            card.bonuses = {};
            for (let slot = 1; slot <= 6; slot++) {
                const key = `cube_${slot}`;
                const val = card[key];
                const bonus = parseBonus(val);
                if (bonus) {
                    card.bonuses[slot] = bonus;
                }
            }

            cards.push(card as CardData);
        }
        return cards;
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
