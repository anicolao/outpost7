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
            // Basic protection against empty lines
            if (values.length < 2) continue;

            const card: any = {};
            headers.forEach((header, index) => {
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

    const baseUrl = import.meta.env.BASE_URL || '/';
    const prefix = baseUrl.endsWith('/') ? `${baseUrl}assets/` : `${baseUrl}/assets/`;

    // Input is like 'blue_module_3.pdf', output should be '/<base>/assets/blue_module_3.png'
    return prefix + filename.replace('.pdf', '.png');
}
