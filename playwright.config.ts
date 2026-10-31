import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
// The e2e suite exercises the built app WITHOUT a reachable backend: public pages, client-side validation,
// route protection and security headers. Placeholder Supabase values are used on purpose.
export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  fullyParallel: true,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
    { name: "mobile", use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } } },
  ],
  webServer: {
    // NEXT_PUBLIC_* values are inlined at BUILD time, so the build runs with the same placeholder env.
    command: `npx next build && npx next start -p ${PORT}`,
    port: PORT,
    reuseExistingServer: false,
    timeout: 240_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:9",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_placeholder_key_for_e2e_only",
      NEXT_PUBLIC_SITE_URL: `http://localhost:${PORT}`,
    },
  },
});
