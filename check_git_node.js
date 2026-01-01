
const { execSync } = require('child_process');
const fs = require('fs');
try {
    const branch = execSync('git branch --show-current').toString().trim();
    const status = execSync('git status').toString();
    fs.writeFileSync('git_info.txt', `BRANCH: ${branch}\n\nSTATUS:\n${status}`);
} catch (e) {
    fs.writeFileSync('git_info.txt', 'Error: ' + e.message);
}
