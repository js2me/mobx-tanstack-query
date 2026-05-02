import { ConfigsManager } from 'sborshik/utils';
import { defineLibVitestConfig } from 'sborshik/vite';
import { defineConfig, mergeConfig } from 'vitest/config';

export default mergeConfig(
  defineLibVitestConfig(ConfigsManager.create()),
  defineConfig({
    test: {
      setupFiles: ['./vitest-setup.ts'],
    },
  }),
);
