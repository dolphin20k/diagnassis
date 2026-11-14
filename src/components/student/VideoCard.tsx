import { Icon } from "@/components/ui/Icon";
import { searchUrl } from "@/lib/scoring";
import type { ActionItem } from "@/lib/types/database";

type Resource = ActionItem["resources"][number];
const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);

/** One learning resource. Videos show the real YouTube thumbnail and open that exact video; others fall back to a search link. */
export function VideoCard({ resource: rs }: { resource: Resource }) {
  const id = rs.kind === "video" && rs.video_id && /^[A-Za-z0-9_-]{11}$/.test(rs.video_id) ? rs.video_id : null;
  const href = id ? `https://www.youtube.com/watch?v=${id}` : searchUrl(rs.search_query, rs.kind);
  const title = id && rs.video_title ? rs.video_title : rs.title;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="group flex h-full items-start gap-3 rounded-lg border border-border p-3 text-ink hover:border-primary hover:bg-indigo-50/40">
      {id ? (
        <span className="relative aspect-video w-28 shrink-0 overflow-hidden rounded-md bg-sidebar sm:w-32">
          {/* Remote YouTube thumbnail: a plain <img> avoids configuring next/image for i.ytimg.com. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`https://i.ytimg.com/vi/${id}/mqdefault.jpg`} alt="" loading="lazy" className="size-full object-cover" />
          <span aria-hidden className="absolute inset-0 grid place-items-center bg-black/10 group-hover:bg-black/0"><span className="grid size-7 place-items-center rounded-full bg-black/70 text-white"><Icon name="play" size={13} fill="currentColor" /></span></span>
        </span>
      ) : (
        <span className="grid size-10 shrink-0 place-items-center rounded-md bg-sidebar text-white"><Icon name={rs.kind === "video" ? "play" : rs.kind === "docs" ? "file-text" : "layers"} size={18} /></span>
      )}
      <span className="min-w-0">
        <span className="line-clamp-2 block font-display text-[15px] font-semibold group-hover:text-primary">{title}</span>
        <span className="block text-xs text-ink-2">{id ? `YouTube${rs.channel ? ` · ${rs.channel}` : ""}` : rs.kind === "video" ? "YouTube search" : "Web search"} · {rs.level ?? cap(rs.kind)}<Icon name="external-link" size={11} className="ml-1 inline" /></span>
      </span>
    </a>
  );
}
