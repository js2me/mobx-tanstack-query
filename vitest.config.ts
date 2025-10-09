import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";

import tsconfig from "./tsconfig.json";
import { resolve } from "path";

const entries = Object.entries(tsconfig.compilerOptions.paths).map(([libName, paths]) => {
  const entryName = paths[0].replace('/index.ts', '').replace('.ts', '').replace('./src/', '');

  return {
    libName,
    entryName: entryName === './src' ? 'index' : entryName,
    entryPath: resolve(__dirname, paths[0]),
  }
})

export default defineConfig({
  // @ts-ignore
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    coverage: {
      provider: 'istanbul', // or 'v8'
      include: ['src'],
      exclude: ['src/preset'],
      reporter: [
        'text',
        'text-summary',
        'html'
      ],
      reportsDirectory: './coverage'
    },
  },
  resolve: {
    alias: Object.assign({}, ...entries.map(entry => {
      return {
        [entry.libName]: entry.entryPath,
      }
    })),
  },
});