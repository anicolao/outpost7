import { describe, expect, it } from 'vitest';
import { parseCards } from './cardLoader';

const HEADERS = [
    'index',
    '@background',
    '@module_resource_1',
    'text_module_resource_1',
    '@cube_1',
    '@cube_2',
    '@cube_3',
    '@cube_4',
    '@cube_5',
    '@cube_6',
];

describe('card data parsing', () => {
    it('parses pasted TSV card data into playable cards', () => {
        const source = [
            HEADERS.join('\t'),
            [
                '1',
                'blue_module_3.pdf',
                'blue_resource.pdf',
                '3',
                'bonus_add_cube.pdf',
                'empty.pdf',
                '',
                '',
                '',
                '',
            ].join('\t'),
            ['2', 'start_2.pdf', '', '', '', '', '', '', '', ''].join('\t'),
        ].join('\n');

        expect(parseCards(source)).toEqual([
            expect.objectContaining({
                index: '1',
                background: 'blue_module_3.pdf',
                cost: 3,
                color: 'blue',
                maxCubes: 2,
                bonuses: { 1: { type: 'ADD_CUBE' } },
            }),
            expect.objectContaining({
                index: '2',
                background: 'start_2.pdf',
                cost: 0,
                color: 'gray',
                maxCubes: 0,
                bonuses: {},
            }),
        ]);
    });

    it('continues to parse the bundled CSV format', () => {
        const source = [
            HEADERS.join(','),
            ['1', 'red_module_4.pdf', 'red_resource.pdf', '4', 'empty.pdf', '', '', '', '', ''].join(','),
        ].join('\n');

        expect(parseCards(source)[0]).toEqual(expect.objectContaining({ cost: 4, color: 'red' }));
    });

    it('rejects malformed or incomplete card sets', () => {
        expect(() => parseCards('')).toThrow('Paste a TSV or CSV card set');
        expect(() => parseCards('index\tbackground\n1\tblue_module_3.pdf')).toThrow(
            'Missing required columns',
        );
        expect(() => parseCards(`${HEADERS.join('\t')}\n1\t\tblue_resource.pdf\t3`)).toThrow(
            'Row 2 is missing a background',
        );
    });
});
