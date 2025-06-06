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
  transformHead: ({ pageData, head }) => {
    head.push(['meta', { property: 'og:site_name', content: packageName }]);
    head.push(['meta', { property: 'og:title', content: pageData.title }]);
    if (pageData.description) {
      head.push(['meta', { property: 'og:description', content: pageData.description }]);   
    }
    head.push(['meta', { property: 'og:image', content: `https://${author}.github.io/${packageName}/logo.png` }]);

    return head
  },
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

    footer: {
      message: `Released under the ${license} License.`,
      copyright: `Copyright © 2024-PRESENT ${author}`,
    },

    socialLinks: [
      { icon: 'github', link: `https://github.com/${author}/${packageName}` },
    ],
  },
});
