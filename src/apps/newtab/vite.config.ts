/// <reference types="vitest" />
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import analog from "@analogjs/platform";
import tailwindcss from "@tailwindcss/vite";
import { globby } from "globby";
import { generateJarManifest } from "../common/scripts/gen_jarmanifest.ts";

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
  build: {
    outDir: "_dist",
    target: ["es2020"],
  },
  resolve: {
    mainFields: ["module"],
  },
  server: {
    port: 5186,
    strictPort: true,
  },
  plugins: [
    analog({
      workspaceRoot: fileURLToPath(new URL(".", import.meta.url)),
      ssr: false,
      static: true,
      prerender: {
        routes: [],
      },
    }),
    tailwindcss(),
    {
      name: "inject_base_href",
      async transformIndexHtml() {
        return [
          {
            tag: "base",
            attrs: {
              href: command === "serve"
                ? "http://localhost:5186/"
                : "chrome://noraneko-newtab/content/",
            },
          },
        ];
      },
    },
    {
      name: "gen_jarmn",
      enforce: "post",
      async generateBundle(options, bundle, isWrite) {
        const _bundle: Record<string, { fileName: string }> = { ...bundle };
        for (
          const publicFile of await globby("**", {
            cwd: fileURLToPath(new URL("./public", import.meta.url)),
            onlyFiles: true,
          })
        ) {
          _bundle[publicFile] = {
            fileName: publicFile,
          };
        }
        this.emitFile({
          type: "asset",
          fileName: "jar.mn",
          needsCodeReference: false,
          source: await generateJarManifest(_bundle, {
            prefix: "content-newtab",
            namespace: "noraneko-newtab",
            register_type: "content",
          }),
        });
        this.emitFile({
          type: "asset",
          fileName: "moz.build",
          needsCodeReference: false,
          source: `JAR_MANIFESTS += ["jar.mn"]`,
        });
      },
    },
  ],
}));
