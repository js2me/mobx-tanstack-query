import { defineConfig } from 'vite';
import Unocss from 'unocss/vite';
import { presetAttributify, presetIcons, presetUno } from 'unocss';
import path from 'path';
import fs from 'fs';

const packageJson = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, '../package.json'),
    { encoding: 'utf-8' },
  ),
)

export default defineConfig({
  optimizeDeps: {
    exclude: ['@vueuse/core', 'vitepress'],
  },
  server: {
    hmr: {
      overlay: false,
    },
  },
  define: {
    __PACKAGE_DATA__: JSON.stringify(packageJson),
  },
  plugins: [
    {
      name: 'replace-package-json-vars',
      transform(code, id) {
        if (!id.endsWith('.md')) return
        return code.replace(/\{packageJson\.(\w+)\}/g, (_, key) => {
          return packageJson[key] || ''
        })
      }
    },
    {
      name: 'replace-source-links',
      transform(code, id ) {
        if (!id.endsWith('.md')) return;
        return code.replace(/(\(\/src\/)/g, `(https://github.com/${packageJson.author}/${packageJson.name}/tree/master/src/`)
      }
    },
    Unocss({
      presets: [
        presetUno({
          dark: 'media',
        }),
        presetAttributify(),
        presetIcons({
          scale: 1.2,
        }),
      ],
    }),
  ],
});
