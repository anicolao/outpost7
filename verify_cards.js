import fs from 'fs';
import path from 'path';

const csvPath = path.resolve('public/cards.csv');
const csvContent = fs.readFileSync(csvPath, 'utf-8');

const lines = csvContent.split('\n').slice(1); // Skip header

const startCards = lines
    .filter(line => line.includes('start_'))
    .map(line => {
        const parts = line.split(',');
        return parts[1]; // background column
    })
    .filter(Boolean);

console.log('Found Start Cards:', startCards.length);
startCards.forEach(bg => {
    const match = bg.match(/start_(\d+)/);
    const count = match ? parseInt(match[1], 10) : 'null';
    console.log(`File: ${bg} -> Count: ${count}`);
});

const moduleCards = lines
    .filter(line => line.includes('module') && !line.includes('start'))
    .map(line => {
        const parts = line.split(',');
        // index, background, module_resource_1, text_module_resource_1 ...
        return { bg: parts[1], text: parts[3] };
    })
    .slice(0, 5);

console.log('Sample Module Cards:');
console.log(moduleCards);
