import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    // bcrypt at cost 12 (matching production) is legitimately slow on
    // modest/shared hardware, especially when several hashes run
    // concurrently (recovery code generation hashes 10 at once).
    testTimeout: 20000,
  },
});
