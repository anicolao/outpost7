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
}

export async function loadCards(): Promise<CardData[]> {
    try {
        const response = await fetch('/cards.csv');
        if (!response.ok) {
            console.error('Failed to load cards.csv');
            return [];
        }
        const text = await response.text();
        const lines = text.trim().split('\n');
        if (lines.length < 2) return [];

        const headers = lines[0].split(',').map(h => h.trim().replace('@', ''));

        // Header mapping:
        // index -> index
        // @background -> background
        // @module_resource_1 -> module_resource_1
        // text_module_resource_1 -> text_module_resource_1
        // @cube_1 -> cube_1

        const cards: CardData[] = [];

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',');
            // Basic protection against empty lines
            if (values.length < 2) continue;

            const card: any = {};
            headers.forEach((header, index) => {
                // Handle potential comma in values? Assuming simple CSV for now based on fileView
                card[header] = values[index]?.trim();
            });
            cards.push(card as CardData);
        }
        return cards;
    } catch (e) {
        console.error("Error loading cards:", e);
        return [];
    }
}

export function getAssetUrl(filename: string): string {
    if (!filename || filename === 'empty.pdf' || filename === '') return '';
    // Input is like 'blue_module_3.pdf', output should be '/assets/blue_module_3.png'
    return '/assets/' + filename.replace('.pdf', '.png');
}
