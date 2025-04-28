import { defineConfig } from 'vitepress';

import path from 'path';
import fs from 'fs';

const { version, name: packageName, author, license } = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, '../../package.json'),
    { encoding: 'utf-8' },
  ),
);

export default defineConfig({
  title: packageName.replace(/-/g, ' '),
  description: `${packageName.replace(/-/g, ' ')} documentation`,
  base: `/${packageName}/`,
  lastUpdated: true,
  head: [
    ['link', { rel: 'icon', href: `/${packageName}/logo.png` }],
  ],
  themeConfig: {
    logo: '/logo.png',
    search: {
      provider: 'local'
    },
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Introduction', link: '/introduction/getting-started' },
      {
        text: `v${version}`,
        items: [
          {
            items: [
              {
                text: `v${version}`,
                link: `https://github.com/${author}/${packageName}/releases/tag/v${version}`,
              },
            ],
          },
        ],
      },
    ],
    sidebar: [
      {
        text: 'Introduction',
        items: [
          { text: 'Getting started', link: '/introduction/getting-started' },
        ],
      },
      {
        text: 'Core API',
        link: '/api/MobxQuery',
        items: [
          { text: 'MobxQuery', link: '/api/MobxQuery' },
          { text: 'MobxMutation', link: '/api/MobxMutation' },
          { text: 'MobxInfiniteQuery', link: '/api/MobxInfiniteQuery' },
          { text: 'MobxQueryClient', link: '/api/MobxQueryClient' },
          { text: 'Other', link: '/api/other' },
        ],
      },
      {
        text: 'Preset API',
        link: '/preset',
        items: [
          { text: 'createQuery', link: '/preset/createQuery' },
          { text: 'createMutation', link: '/preset/createMutation' },
          { text: 'createInfiniteQuery', link: '/preset/createInfiniteQuery' },
          { text: 'queryClient', link: '/preset/queryClient' },
        ]
      },
      {
        text: 'Other',
        items: [
          { text: 'Project examples', link: '/other/project-examples' },
          { text: 'Swagger Codegen', link: '/other/swagger-codegen' },
        ],
      }
    ],

    footer: {
      message: `Released under the ${license} License.`,
      copyright: `Copyright © 2024-PRESENT ${author}`,
    },

    socialLinks: [
      { icon: 'github', link: `https://github.com/${author}/${packageName}` },
    ],
  },
});
