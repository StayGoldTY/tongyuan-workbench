import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? "/tongyuan-workbench/",
  plugins: [react()],
  resolve: {
    alias: {
      "@tongyuan/contracts": path.resolve(
        currentDirectory,
        "../../packages/contracts/src/index.ts",
      ),
    },
  },
});
