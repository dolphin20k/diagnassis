import type { Config } from "@netlify/functions";

/**
 * Runs every two days (01:00 UTC). Scheduled functions are limited to ~30s, so this only
 * kicks off the long-running background function and returns immediately.
 */
export default async () => {
  const base = process.env.URL;
  const secret = process.env.CRON_SECRET;
  if (!base || !secret) {
    console.error("market-research: URL or CRON_SECRET missing; skipping");
    return;
  }
  const res = await fetch(`${base}/.netlify/functions/market-research-background`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}` },
  });
  console.log("market-research: background function responded", res.status);
};

export const config: Config = { schedule: "0 1 */2 * *" };
