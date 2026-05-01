import { DefaultTheme } from "vitepress";
 
export const sidebar: DefaultTheme.Config['sidebar'] = [
  {
    text: "Introduction",
    items: [
      { text: "Getting started", link: "/v6/introduction/getting-started" },
    ],
  },
  {
    text: "Core API",
    link: "/v6/api/Query",
    items: [
      { text: "Query", link: "/v6/api/Query" },
      { text: "Mutation", link: "/v6/api/Mutation" },
      { text: "InfiniteQuery", link: "/v6/api/InfiniteQuery" },
      { text: "QueryClient", link: "/v6/api/QueryClient" },
      { text: "Other", link: "/v6/api/other" },
    ],
  },
  {
    text: "Preset API",
    link: "/v6/preset",
    items: [
      { text: "Overview", link: "/v6/preset" },
      { text: "createQuery", link: "/v6/preset/createQuery" },
      { text: "createMutation", link: "/v6/preset/createMutation" },
      { text: "createInfiniteQuery", link: "/v6/preset/createInfiniteQuery" },
      { text: "queryClient", link: "/v6/preset/queryClient" },
    ],
  },
  {
    text: "Other",
    items: [
      { text: "Project examples", link: "/v6/other/project-examples" },
      { text: "Swagger Codegen", link: "/v6/other/swagger-codegen" },
    ],
  },
];