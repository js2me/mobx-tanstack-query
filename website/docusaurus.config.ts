import { themes as prismThemes } from 'prism-react-renderer';
import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';
import { visit } from "unist-util-visit";
import * as packageJson from "../package.json" assert { type: "json" };

const REPO_URL = `https://github.com/${packageJson.author}/${packageJson.name}/blob/master`;

const config: Config = {
  staticDirectories: ['../assets', '../docs', '../i18n'],
  title: packageJson.name,
  tagline: packageJson.description,
  favicon: 'logo.png',

  // Set the production url of your site here
  url: `https://${packageJson.author}.github.io`,
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: `/${packageJson.name}/`,
  deploymentBranch: 'gh-pages',

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: `${packageJson.author}.github.io`, // Usually your GitHub org/user name.
  projectName: packageJson.name, // Usually your repo name.
  trailingSlash: false,

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'ru']
  },
  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          path: '../docs',
          remarkPlugins: [
            () => (tree) => {
              visit(tree, 'link', node => {
                if (node.url.startsWith('/src/')) {
                  node.url = `${REPO_URL}${node.url}`;
                } 
              })
            }
          ],
          routeBasePath: '/', // Добавьте эту строку
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          editUrl: ({ docPath, locale, permalink, version, versionDocsDirPath}) =>  {
            return `https://github.com/${packageJson.author}/${packageJson.name}/tree/master/docs/${docPath}`
          },
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],
  // themes: ['@docusaurus/theme-search-algolia'],
  themeConfig: {
    // Replace with your project's social card
    image: 'img/docusaurus-social-card.jpg',
    navbar: {
      title: packageJson.name,
      logo: {
        alt: '',
        src: 'logo.png',
      },
      items: [
        {
          label: 'Getting Started',
          to: 'getting-started',
          activeBasePath: 'getting-started',
        },
        {
          label: 'API',
          to: 'api/mobx-query/overview',
          activeBasePath: 'api',
        },
        {
          href: packageJson.repository.url.replace('git://', 'https://'),
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    algolia: {

      appId: "GSHJVLO9W1",
      
      apiKey: "f27275b193a65a34f795b997e0b65b50",
      
      indexName: "mobx-tanstack-query",
      

      // Optional: see doc section below
      contextualSearch: true,

      // Optional: Specify domains where the navigation should occur through window.location instead on history.push. Useful when our Algolia config crawls multiple documentation sites and we want to navigate with window.location.href to them.
      // externalUrlRegex: 'external\\.com|domain\\.com',

      // Optional: Replace parts of the item URLs from Algolia. Useful when using the same search index for multiple deployments using a different baseUrl. You can use regexp or string in the `from` param. For example: localhost:3000 vs myCompany.com/docs
      replaceSearchResultPathname: {
        from: '/docs/', // or as RegExp: /\/docs\//
        to: '/',
      },

      // Optional: Algolia search parameters
      searchParameters: {},

      // Optional: path for search page that enabled by default (`false` to disable it)
      searchPagePath: 'search',

      // Optional: whether the insights feature is enabled or not on Docsearch (`false` by default)
      insights: false,

      //... other Algolia params
    },
    footer: {
      style: 'dark',
      links: [],
      copyright: `Copyright © ${new Date().getFullYear()} Sergey Volkov. Built with Docusaurus`,
    },
    docs: {
      sidebar: {
        hideable: false
      },
    },
    colorMode: {
      defaultMode: 'dark',
      respectPrefersColorScheme: true,
    },
    prism: {
      theme: prismThemes.vsDark,
      darkTheme: prismThemes.vsDark,
    },
  } satisfies Preset.ThemeConfig,
  plugins: [
    ['./src/plugins/tailwind-config.js', {}],
  ]
};

export default config;
