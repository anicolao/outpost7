import { describe, expect, it } from 'vitest';
import type { CardData } from './cardLoader';
import { cardSetDocumentId, validatePlayableCardSet } from './card-set-repository';

const card = (background: string): CardData => ({
    index: background,
    background,
    module_resource_1: background.includes('module') ? 'blue_resource.pdf' : '',
    text_module_resource_1: background.includes('module') ? '3' : '',
    cube_1: '',
    cube_2: '',
    cube_3: '',
    cube_4: '',
    cube_5: '',
    cube_6: '',
    cost: background.includes('module') ? 3 : 0,
    color: background.includes('module') ? 'blue' : 'gray',
    bonuses: {},
    maxCubes: 0,
});

describe('card-set validation', () => {
    it('normalizes names into stable, case-insensitive document IDs', () => {
        expect(cardSetDocumentId(' v49 ')).toBe('set-v49');
        expect(cardSetDocumentId('V49')).toBe('set-v49');
    });

    it('accepts enough module and header cards to initialize a game', () => {
        const cards = [
            ...Array.from({ length: 25 }, (_, index) => card(`blue_module_${index}.pdf`)),
            ...Array.from({ length: 10 }, (_, index) => card(`start_${index}.pdf`)),
        ];

        expect(() => validatePlayableCardSet(cards)).not.toThrow();
    });

    it('rejects sets that cannot deal the opening game state', () => {
        const modules = Array.from({ length: 25 }, (_, index) => card(`blue_module_${index}.pdf`));
        const headers = Array.from({ length: 10 }, (_, index) => card(`start_${index}.pdf`));

        expect(() => validatePlayableCardSet([...modules.slice(1), ...headers])).toThrow(
            'at least 25 module cards',
        );
        expect(() => validatePlayableCardSet([...modules, ...headers.slice(1)])).toThrow(
            'at least 10 start cards',
        );
    });
});
