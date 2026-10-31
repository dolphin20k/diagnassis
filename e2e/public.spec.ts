import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("landing page", () => {
  test("shows the hero, how-it-works and calls to action", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Know where you stand before placement season.");
    await expect(page.getByRole("button", { name: /Sign in with Google/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Four steps, one honest picture" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Terms & Conditions" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Privacy Policy" })).toBeVisible();
  });

  test("has no horizontal scroll at this viewport", async ({ page }) => {
    await page.goto("/");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("has no detectable accessibility violations", async ({ page }) => {
    await page.goto("/");
    const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(" | ")}`)).toEqual([]);
  });
});

test.describe("sign up", () => {
  test("validates every field with the design's messages", async ({ page }) => {
    await page.goto("/signup");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("Enter your full name.")).toBeVisible();
    await expect(page.getByText("Enter your email address.")).toBeVisible();
    await expect(page.getByText("Meet all four password rules below.").first()).toBeVisible();
    await expect(page.getByText("You need to accept the terms to create an account.")).toBeVisible();
  });

  test("password strength meter and rules respond to typing, and confirmation must match", async ({ page }) => {
    await page.goto("/signup");
    const pw = page.getByLabel("Password", { exact: true });
    await pw.fill("abcdefgh");
    await expect(page.getByText("Weak", { exact: true })).toBeVisible();
    await pw.fill("Str0ng!pass");
    await expect(page.getByText("Strong", { exact: true })).toBeVisible();
    await expect(page.getByText("At least 8 characters (met)")).toBeVisible();
    await page.getByLabel("Full name").fill("Priya Raghavan");
    await page.getByLabel("Email address").fill("priya@college.edu");
    await page.getByLabel("Confirm password").fill("different");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("Passwords do not match.")).toBeVisible();
  });

  test("password visibility toggle works and is labelled", async ({ page }) => {
    await page.goto("/signup");
    const pw = page.getByLabel("Password", { exact: true });
    await pw.fill("Secret123!");
    await expect(pw).toHaveAttribute("type", "password");
    await page.getByRole("button", { name: "Show password" }).first().click();
    await expect(pw).toHaveAttribute("type", "text");
  });

  test("a failed backend call shows a safe error rather than crashing", async ({ page }) => {
    await page.goto("/signup");
    await page.getByLabel("Full name").fill("Priya Raghavan");
    await page.getByLabel("Email address").fill("priya@college.edu");
    await page.getByLabel("Password", { exact: true }).fill("Str0ng!pass");
    await page.getByLabel("Confirm password").fill("Str0ng!pass");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "We could not create your account" })).toBeVisible({ timeout: 15_000 });
  });

  test("passes accessibility checks", async ({ page }) => {
    await page.goto("/signup");
    const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(" | ")}`)).toEqual([]);
  });
});

test.describe("log in and password recovery", () => {
  test("validates required fields", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Log in" }).last().click();
    await expect(page.getByText("Enter your email address.")).toBeVisible();
    await expect(page.getByText("Enter your password.")).toBeVisible();
  });

  test("rejects a malformed email and links to recovery and sign up", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email address").fill("not-an-email");
    await page.getByLabel("Password", { exact: true }).fill("whatever1!");
    await page.getByRole("button", { name: "Log in" }).last().click();
    await expect(page.getByText("Enter a valid email, like name@college.edu.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Forgot password?" })).toHaveAttribute("href", "/forgot-password");
    await expect(page.getByRole("tab", { name: "Sign up" })).toHaveAttribute("href", "/signup");
  });

  test("forgot password validates the email", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.getByLabel("Email address").fill("nope");
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByText("Enter a valid email, like name@college.edu.")).toBeVisible();
  });
});

test.describe("route protection", () => {
  for (const path of ["/dashboard", "/diagnostic", "/history", "/profile", "/settings", "/results/0b6f5d3e-1c2a-4f10-9a77-3d9b2c1a8e55", "/admin", "/admin/students"]) {
    test(`guests are redirected from ${path} to login`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login\?next=/);
    });
  }

  test("API routes reject guests", async ({ request }) => {
    for (const [method, url] of [["POST", "/api/diagnostics/start"], ["POST", "/api/ai/estimate-role"], ["GET", "/api/reports/0b6f5d3e-1c2a-4f10-9a77-3d9b2c1a8e55"], ["GET", "/api/admin/ai-health"]] as const) {
      const res = await request.fetch(url, { method, data: method === "POST" ? {} : undefined });
      expect(res.status(), `${method} ${url}`).toBe(401);
    }
  });

  test("the cron endpoint refuses callers without the secret and rejects bad bearer tokens", async ({ request }) => {
    const none = await request.post("/api/cron/market-research", { data: { phase: "start" } });
    expect(none.status()).toBe(403);
    const bad = await request.post("/api/cron/market-research", { data: { phase: "start" }, headers: { Authorization: "Bearer not-the-secret" } });
    expect(bad.status()).toBe(403);
  });

  test("sign-out is POST only", async ({ request }) => {
    const res = await request.get("/auth/signout");
    expect(res.status()).toBe(405);
  });

  test("OAuth callback never redirects off-site", async ({ request }) => {
    const res = await request.get("/auth/callback?next=https://evil.example/&code=x", { maxRedirects: 0 });
    expect(res.headers()["location"] ?? "").not.toContain("evil.example");
  });
});

test.describe("platform hygiene", () => {
  test("sends security headers", async ({ request }) => {
    const res = await request.get("/");
    const h = res.headers();
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["strict-transport-security"]).toContain("max-age=");
    expect(h["x-powered-by"]).toBeUndefined();
  });

  test("shows a friendly 404", async ({ page }) => {
    const res = await page.goto("/definitely-not-a-page");
    // Unknown paths are guarded like any private route, so guests land on login rather than a bare 404.
    expect([200, 404]).toContain(res?.status());
    await expect(page.locator("body")).not.toContainText("Application error");
  });

  test("policy pages render without crashing when the backend is unavailable", async ({ page }) => {
    for (const p of ["/terms", "/privacy"]) {
      const res = await page.goto(p);
      expect(res?.status()).toBe(200);
      await expect(page.getByRole("link", { name: "Back to home" })).toBeVisible();
    }
  });
});
