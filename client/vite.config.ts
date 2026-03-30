import { defineConfig } from "vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import viteTsConfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";

const config = defineConfig({
  plugins: [
    devtools(),
    nitro({
      routeRules: {
        "/api/markets/public/**": {
          proxy: `${process.env.VITE_API_URL || "http://localhost:4001"}/api/markets/public/**`,
        },

        "/api/markets/sse/**": {
          proxy: `${process.env.VITE_API_URL || "http://localhost:4001"}/api/markets/sse/**`,
        },
        "/api/users/sse/**": {
          proxy: `${process.env.VITE_API_URL || "http://localhost:4001"}/api/users/sse/**`,
        },
      },
    }),
    viteTsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
});

export default config;
