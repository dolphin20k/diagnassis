import { expect, test } from "@playwright/test";

/** Captures screens for manual comparison with the design handoff (test-results/screens/). */
for (const [name, path] of [["landing", "/"], ["login", "/login"], ["signup", "/signup"], ["forgot", "/forgot-password"]] as const) {
  test(`capture ${name}`, async ({ page }, info) => {
    await page.goto(path, { waitUntil: "networkidle" });
    await expect(page.locator("body")).not.toContainText("Application error");
    await page.screenshot({ path: `test-results/screens/${name}-${info.project.name}.png`, fullPage: name === "landing" });
  });
}
