import { defineConfig } from "vite";
import { resolve } from "path";

// Get entry from env or default to all
const entry = process.env.ENTRY;

const entries: Record<string, string> = {
  background: resolve(__dirname, "src/background/index.ts"),
  content: resolve(__dirname, "src/content/index.ts"),
  popup: resolve(__dirname, "src/popup/index.ts"),
};

// If specific entry requested, build as IIFE (self-contained)
// Otherwise build all as ES modules (for type checking)
const buildConfig = entry
  ? {
      lib: {
        entry: entries[entry]!,
        formats: ["iife"] as any,
        name: entry,
        fileName: () => `${entry}.js`,
      },
      outDir: "dist",
      emptyOutDir: false,
      minify: false,
      sourcemap: true,
    }
  : {
      rollupOptions: {
        input: entries,
        output: {
          entryFileNames: "[name].js",
          dir: "dist",
        },
      },
      minify: false,
      sourcemap: true,
    };

export default defineConfig({
  build: buildConfig,
});
