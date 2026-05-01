import { defineDocsVitepressConfig } from "sborshik/vitepress";
import { ConfigsManager } from "sborshik/utils/configs-manager";
import { sidebar as v6Sidebar } from "../v6/sidebar";

const configs = ConfigsManager.create("../");

export default defineDocsVitepressConfig(configs, {
  createdYear: "2024",
  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Introduction', link: '/introduction/getting-started' },
      {
        component: "NavVersionsFlyout",
      },
    ],
    /** Пустой сайдбар на v6; остальные маршруты (v7 / latest) — полная навигация. Ключ «/v6/» длиннее «/», поэтому перекрывает для путей под v6. */
    sidebar: {
      "/v6/": v6Sidebar as any,
      "/": [
				{
					text: "Introduction",
					items: [
						{ text: "Getting started", link: "/introduction/getting-started" },
					],
				},
				{
					text: "Core API",
					link: "/api/Query",
					items: [
						{ text: "Query", link: "/api/Query" },
						{ text: "Mutation", link: "/api/Mutation" },
						{ text: "InfiniteQuery", link: "/api/InfiniteQuery" },
						{ text: "QueryClient", link: "/api/QueryClient" },
						{ text: "Other", link: "/api/other" },
					],
				},
				{
					text: "Preset API",
					link: "/preset",
					items: [
						{ text: "Overview", link: "/preset" },
						{ text: "createQuery", link: "/preset/createQuery" },
						{ text: "createMutation", link: "/preset/createMutation" },
						{ text: "createInfiniteQuery", link: "/preset/createInfiniteQuery" },
						{ text: "queryClient", link: "/preset/queryClient" },
					],
				},
				{
					text: "Other",
					items: [
						{ text: "Project examples", link: "/other/project-examples" },
						{ text: "Swagger Codegen", link: "/other/swagger-codegen" },
					],
				},
			],
    },
  },
});
