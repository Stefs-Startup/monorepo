import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const srcDir = path.join(rootDir, 'src');
const angularJsonPath = path.join(rootDir, 'angular.json');

function collectTsFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTsFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      files.push(full);
    }
  }
  return files;
}

const errors = [];

// 1. Verify bundle budgets exist in angular.json
const angularConfig = JSON.parse(fs.readFileSync(angularJsonPath, 'utf8'));
const budgets =
  angularConfig?.projects?.['pulse-web']?.architect?.build?.configurations?.production?.budgets ?? [];
if (!Array.isArray(budgets) || budgets.length === 0) {
  errors.push('angular.json: Missing production bundle budgets configuration.');
}

// 2. Audit TypeScript & Angular 21 Standalone Signals conventions
const tsFiles = collectTsFiles(srcDir);
for (const file of tsFiles) {
  const rel = path.relative(rootDir, file);
  const content = fs.readFileSync(file, 'utf8');

  if (content.includes('*ngIf') || content.includes('*ngFor') || content.includes('*ngSwitch')) {
    errors.push(`${rel}: Legacy structural directive (*ngIf/*ngFor/*ngSwitch) detected; use @if/@for/@switch.`);
  }
  if (content.includes('@ts-ignore')) {
    errors.push(`${rel}: Unapproved @ts-ignore comment detected.`);
  }
  if (file.endsWith('.component.ts') && !content.includes('standalone: true')) {
    errors.push(`${rel}: Component must declare standalone: true.`);
  }
}

if (errors.length > 0) {
  console.error('Angular 21 Stack Lint failed:');
  for (const err of errors) {
    console.error(`  - ${err}`);
  }
  process.exit(1);
}

console.log(`PASS Angular 21 Lint: audited ${tsFiles.length} TypeScript files and production bundle budgets.`);
