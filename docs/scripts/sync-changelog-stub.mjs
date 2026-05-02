import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const docsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = path.join(docsDir, 'changelog.md');

writeFileSync(
	target,
	`---
outline: deep
---

`,
	'utf-8',
);
