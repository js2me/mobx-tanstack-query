import { defineDocsVitepressConfig } from "sborshik/vitepress";
import { ConfigsManager } from "sborshik/utils/configs-manager";

const configs = ConfigsManager.create("../")

export default defineDocsVitepressConfig(configs, {
  createdYear:'2024',
  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Introduction', link: '/introduction/getting-started' },
      {
        text: `${configs.package.version}`,
        items: [
          {
            items: [
              {
                text: `${configs.package.version}`,
                link: `https://github.com/${configs.package.author}/${configs.package.name}/releases/tag/${configs.package.version}`,
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
