/**
 * Background function (15-minute limit). Drives the research pipeline one role at a time through the
 * app's /api/cron/market-research endpoint so every step stays within the app's own request limits.
 */
export default async (req: Request) => {
  const base = process.env.URL;
  const secret = process.env.CRON_SECRET;
  if (!base || !secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    console.error("market-research-background: unauthorized or misconfigured");
    return;
  }
  const call = async (body: unknown) => {
    const res = await fetch(`${base}/api/cron/market-research`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`step failed with ${res.status}`);
    return (await res.json()) as Record<string, unknown>;
  };
  const start = (await call({ phase: "start" })) as { runId: string; roles: { id: string; name: string }[] };
  for (const role of start.roles) {
    try {
      await call({ phase: "role", runId: start.runId, roleId: role.id });
    } catch (e) {
      console.error("market-research-background: role failed", role.name, e instanceof Error ? e.message : e);
    }
  }
  console.log("market-research-background: finished", await call({ phase: "finish", runId: start.runId }));
};
