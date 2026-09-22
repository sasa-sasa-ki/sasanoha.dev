import vue from "@astrojs/vue";
import { defineConfig } from "astro/config";

export default defineConfig({
  output: "static",
  site: "https://sasanoha.dev",
  integrations: [vue()],
});
