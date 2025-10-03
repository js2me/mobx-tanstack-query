import { defineConfig } from 'vitepress';

import path from 'path';
import fs from 'fs';

import { defineGhPagesDocConfig } from "sborshik/vitepress/define-gh-pages-doc-config";

const pckgJson = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, '../../package.json'),
    { encoding: 'utf-8' },
  ),
);

export default defineGhPagesDocConfig(pckgJson, {
  createdYear: '2024',
  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Introduction', link: '/introduction/getting-started' },
      {
        text: `${pckgJson.version}`,
        items: [
          {
            items: [
              {
                text: `${pckgJson.version}`,
                link: `https://github.com/${pckgJson.author}/${pckgJson.name}/releases/tag/${pckgJson.version}`,
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
        link: '/api/Query',
        items: [
          { text: 'Query', link: '/api/Query' },
          { text: 'Mutation', link: '/api/Mutation' },
          { text: 'InfiniteQuery', link: '/api/InfiniteQuery' },
          { text: 'QueryClient', link: '/api/QueryClient' },
          { text: 'Other', link: '/api/other' },
        ],
      },
      {
        text: 'Preset API',
        link: '/preset',
        items: [
          { text: 'Overview', link: '/preset' },
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
  },
});
