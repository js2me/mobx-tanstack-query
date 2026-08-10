import { defineDocsVitepressConfig } from "sborshik/vitepress";
import { ConfigsManager } from "sborshik/utils/configs-manager";
import { sidebar as v6Sidebar } from "../v6/sidebar";

const configs = ConfigsManager.create("../");

export default defineDocsVitepressConfig(configs, {
  createdYear: "2024",
  themeConfig: {
    nav: [
			{
				text: 'CHANGELOG',
				link: '/changelog',
			},
      {
        component: "NavVersionsFlyout",
        props: {
          packageVersion: String(configs.package.version),
        },
      },
    ],
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
						{ text: "FetchQuery", link: "/api/FetchQuery" },
						{ text: "Mutation", link: "/api/Mutation" },
						{ text: "InfiniteQuery", link: "/api/InfiniteQuery" },
						{ text: "FetchInfiniteQuery", link: "/api/FetchInfiniteQuery" },
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
						{ text: "createFetchQuery", link: "/preset/createFetchQuery" },
						{ text: "createMutation", link: "/preset/createMutation" },
						{ text: "createInfiniteQuery", link: "/preset/createInfiniteQuery" },
						{ text: "createFetchInfiniteQuery", link: "/preset/createFetchInfiniteQuery" },
						{ text: "queryClient", link: "/preset/queryClient" },
					],
				},
				{
					text: "Errors 🚨",
					link: "/errors/1",
					items: [
						{ text: "#1: Fetch query is not configured", link: "/errors/1" },
						{ text: "#2: Fetch infinite query is not configured", link: "/errors/2" },
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
