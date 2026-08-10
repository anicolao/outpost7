import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function pngDimensions(path: string) {
    const image = readFileSync(path);
    expect(image.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    return {
        width: image.readUInt32BE(16),
        height: image.readUInt32BE(20),
    };
}

describe('brand artwork', () => {
    it('provides a print-sized 3:2 box lid', () => {
        const dimensions = pngDimensions('public/assets/box_lid.png');
        expect(dimensions.width).toBeGreaterThanOrEqual(1500);
        expect(dimensions.height).toBeGreaterThanOrEqual(1000);
        expect(dimensions.width / dimensions.height).toBeCloseTo(1.5, 2);
    });

    it('provides a high-resolution square app icon', () => {
        const dimensions = pngDimensions('public/assets/app_icon.png');
        expect(dimensions.width).toBeGreaterThanOrEqual(1024);
        expect(dimensions.height).toBe(dimensions.width);
    });

    it('uses the app icon in browser and home-screen metadata', () => {
        const html = readFileSync('index.html', 'utf8');
        expect(html).toContain('<link rel="icon" type="image/png" href="/assets/app_icon.png" />');
        expect(html).toContain('<link rel="apple-touch-icon" href="/assets/app_icon.png" />');
    });
});
