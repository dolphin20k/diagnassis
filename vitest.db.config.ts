import { defineConfig } from "vitest/config";

// Database tests run against a disposable Postgres (see supabase/tests/run-local.sh).
export default defineConfig({
  test: {
    environment: "node",
    include: ["supabase/tests/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
  },
});
