import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineDocsBuildConfig } from 'sborshik/vitepress';
import { ConfigsManager } from 'sborshik/utils/configs-manager';

const configs = ConfigsManager.create('../');

const docsDir = fileURLToPath(new URL('.', import.meta.url));
const changelogPage = path.resolve(docsDir, 'changelog.md');
const repoChangelog = path.resolve(docsDir, '../CHANGELOG.md');

function rootChangelogMarkdownPlugin(): import('vite').Plugin {
	return {
		name: 'vitepress-root-changelog',
		transform(_code, id) {
			if (!id.endsWith('.md')) return;
			const file = id.split('?')[0];
			if (path.normalize(file) !== path.normalize(changelogPage)) return;
			const body = readFileSync(repoChangelog, 'utf-8');
			return `---
outline: deep
---

${body}`;
		},
	};
}

export default defineDocsBuildConfig(configs, {
	// @ts-expect-error
	plugins: [rootChangelogMarkdownPlugin()],
});
