/** Renders policy text stored as "## Heading\nparagraph" sections (plain text; never injected as HTML). */
export function PolicyBody({ body }: { body: string }) {
  const blocks = body.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  return (
    <div className="flex flex-col gap-4">
      {blocks.map((b, i) => {
        const m = /^##\s+(.*)\n?([\s\S]*)$/.exec(b);
        return m ? (
          <section key={i}>
            <h2 className="mb-1 text-[17px]">{m[1]}</h2>
            {m[2] ? <p className="whitespace-pre-line text-[15px] text-slate-700">{m[2]}</p> : null}
          </section>
        ) : (
          <p key={i} className="whitespace-pre-line text-[15px] text-slate-700">{b}</p>
        );
      })}
    </div>
  );
}
