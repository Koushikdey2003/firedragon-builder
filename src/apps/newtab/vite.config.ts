/// <reference types="vitest" />

import { defineConfig } from 'vite';
import analog from '@analogjs/platform';
import tailwindcss from '@tailwindcss/vite';
import {generateJarManifest} from "../common/scripts/gen_jarmanifest.ts";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  build: {
    outDir: "_dist",
    target: ['es2020'],
  },
  resolve: {
    mainFields: ['module'],
  },
  server: {
    port: 5186,
    strictPort: true,
  },
  plugins: [
    analog({
      ssr: false,
      static: true,
      prerender: {
        routes: [],
      },
    }),
    tailwindcss(),
    {
      name: "gen_jarmn",
      enforce: "post",
      async generateBundle(options, bundle, isWrite) {
        this.emitFile({
          type: "asset",
          fileName: "jar.mn",
          needsCodeReference: false,
          source: await generateJarManifest(bundle, {
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
