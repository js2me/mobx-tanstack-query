<script setup lang="ts">
import type { DefaultTheme } from "vitepress/theme";
import { computed } from "vue";
import { useData } from "vitepress";
import VPFlyout from "vitepress/dist/client/theme-default/components/VPFlyout.vue";
import VPNavScreenMenuGroup from "vitepress/dist/client/theme-default/components/VPNavScreenMenuGroup.vue";
import { isActive } from "vitepress/dist/client/shared";

defineProps<{
  /** Мобильное меню (fullscreen nav) */
  screenMenu?: boolean;
}>();

const { page } = useData();

const items: DefaultTheme.NavItemWithLink[] = [
  { text: "v7 (latest)", link: "/introduction/getting-started" },
  { text: "v6", link: "/v6/" },
];

const buttonLabel = computed(() => {
  const rel = page.value.relativePath;
  if (rel.startsWith("v6/")) return "v6";
  return "v7";
});

const childrenActive = computed(() =>
  items.some((navItem) =>
    isActive(page.value.relativePath, navItem.link, false),
  ),
);
</script>

<template>
  <VPNavScreenMenuGroup
    v-if="screenMenu"
    :text="buttonLabel"
    :items="items"
  />
  <VPFlyout
    v-else
    :class="{
      VPNavBarMenuGroup: true,
      active: childrenActive,
    }"
    :button="buttonLabel"
    :label="`${buttonLabel}, select version`"
    :items="items"
  />
</template>
