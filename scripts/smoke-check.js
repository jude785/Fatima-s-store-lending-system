const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const ejs = require('ejs');

const roots = ['config', 'controllers', 'middleware', 'routes', 'services', 'sql', 'utils'];

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(fullPath) : fullPath;
  });
}

const jsFiles = ['server.js', ...roots.flatMap(walk)].filter((file) => file.endsWith('.js'));
const ejsFiles = walk('views').filter((file) => file.endsWith('.ejs'));

for (const file of jsFiles) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status);
}

for (const file of ejsFiles) {
  ejs.compile(fs.readFileSync(file, 'utf8'), { filename: file });
}

console.log(`Checked ${jsFiles.length} JavaScript files and compiled ${ejsFiles.length} EJS templates.`);
