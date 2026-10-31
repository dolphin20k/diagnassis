export function ScoreRing({ value, size = 88, label, track = "var(--border)", stroke = 8 }: { value: number; size?: number; label?: string; track?: string; stroke?: number }) {
  const r = (size - stroke - 4) / 2;
  const C = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`Score ${v} out of 100`}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--cyan)" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - v / 100)} style={{ transition: "stroke-dashoffset 600ms var(--ease)" }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center font-display font-bold" style={{ fontSize: size / 4 }}>{label ?? `${v}%`}</div>
    </div>
  );
}
