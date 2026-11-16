import "server-only";
import type { ActionItem } from "@/lib/types/database";

/**
 * Resolves a search phrase to a real YouTube video so a recommendation opens that exact video (not a search page).
 *  1. YOUTUBE_API_KEY set  -> YouTube Data API v3 search (most reliable, 100 quota units per lookup).
 *  2. otherwise            -> the public results page, reading the first video ids from it (no key needed).
 * Every candidate is verified with YouTube's public oEmbed endpoint, which also returns the real title and channel,
 * so private, deleted or non-embeddable videos are skipped. Failures never throw: callers keep a search link.
 */
export interface ResolvedVideo { id: string; title: string; channel: string | null }

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const UA = "Mozilla/5.0 (compatible; DiagnassisBot/1.0)";
const cache = new Map<string, { at: number; v: ResolvedVideo[] }>();
const TTL = 24 * 60 * 60 * 1000;
/** Insights are user-writable (save_attempt_insights), so bound the work and memory a single request or user can cause. */
const MAX_CACHE = 300;
const MAX_ACTIONS = 5;
const MAX_RESOURCES = 3;

async function candidateIds(query: string): Promise<string[]> {
  const key = process.env.YOUTUBE_API_KEY;
  if (key) {
    const u = new URL("https://www.googleapis.com/youtube/v3/search");
    u.search = new URLSearchParams({ part: "snippet", type: "video", videoEmbeddable: "true", safeSearch: "strict", maxResults: "6", q: query, key }).toString();
    const res = await fetch(u, { signal: AbortSignal.timeout(6000) });
    if (res.ok) {
      const body = (await res.json()) as { items?: { id?: { videoId?: string } }[] };
      const ids = (body.items ?? []).map((i) => i.id?.videoId ?? "").filter((i) => VIDEO_ID.test(i));
      if (ids.length) return ids;
    }
  }
  // sp=EgIQAQ== restricts results to videos (no channels, playlists or shorts shelves).
  const res = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=EgIQAQ%253D%253D&hl=en`, {
    headers: { "User-Agent": UA, "Accept-Language": "en" },
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) return [];
  const html = await res.text();
  const ids: string[] = [];
  for (const m of html.matchAll(/"videoRenderer":\{"videoId":"([A-Za-z0-9_-]{11})"/g)) if (!ids.includes(m[1]!)) ids.push(m[1]!);
  return ids.slice(0, 6);
}

async function verify(id: string): Promise<ResolvedVideo | null> {
  try {
    const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}&format=json`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const b = (await res.json()) as { title?: string; author_name?: string };
    return b.title ? { id, title: b.title.slice(0, 160), channel: b.author_name?.slice(0, 80) ?? null } : null;
  } catch {
    return null;
  }
}

/** Returns up to `limit` distinct, verified videos for the query (never throws). */
export async function findVideos(query: string, limit = 1, exclude: ReadonlySet<string> = new Set()): Promise<ResolvedVideo[]> {
  const q = query.trim().slice(0, 120);
  if (q.length < 3) return [];
  const hit = cache.get(q.toLowerCase());
  let pool = hit && Date.now() - hit.at < TTL ? hit.v : null;
  if (!pool) {
    try {
      const ids = await candidateIds(q);
      const checked = await Promise.all(ids.slice(0, 5).map(verify));
      pool = checked.filter((v): v is ResolvedVideo => v !== null);
    } catch {
      pool = [];
    }
    if (pool.length) {
      if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value as string); // evict the oldest entry
      cache.set(q.toLowerCase(), { at: Date.now(), v: pool });
    }
  }
  return pool.filter((v) => !exclude.has(v.id)).slice(0, limit);
}

/** Fills video_id / video_title / channel on every "video" resource that has none yet; each action gets distinct videos. */
export async function attachVideos(actions: ActionItem[]): Promise<ActionItem[]> {
  return Promise.all(
    actions.map(async (a, idx) => {
      if (idx >= MAX_ACTIONS) return a;
      const used = new Set(a.resources.map((r) => r.video_id).filter((x): x is string => !!x));
      const resources = [...a.resources];
      for (let i = 0; i < Math.min(resources.length, MAX_RESOURCES); i++) {
        const r = resources[i]!;
        if (r.kind !== "video" || r.video_id) continue;
        const [v] = await findVideos(r.search_query, 1, used);
        if (v) {
          used.add(v.id);
          resources[i] = { ...r, video_id: v.id, video_title: v.title, channel: v.channel };
        }
      }
      return { ...a, resources };
    }),
  );
}
