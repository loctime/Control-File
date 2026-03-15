const fs = require('fs');
const path = require('path');

const packageJsonPath = path.join(__dirname, '..', 'package.json');
const outputPath = path.join(__dirname, '..', 'src', 'internal', 'sdk-meta.ts');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

const content = `export const SDK_VERSION = '${packageJson.version}';\n`;

fs.writeFileSync(outputPath, content, 'utf8');
