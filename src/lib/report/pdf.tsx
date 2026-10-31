import "server-only";
import path from "node:path";
import fs from "node:fs";
import { Document, Font, Image, Page, StyleSheet, Svg, Circle, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { AttemptInsights, AttemptResult } from "@/lib/types/database";
import { BAND_COPY, deltaLabel, trendLabel } from "@/lib/scoring";

const root = process.cwd();
const fontDir = path.join(root, "src", "assets", "pdf-fonts");
let fontsRegistered = false;
function registerFonts() {
  if (fontsRegistered) return;
  Font.register({
    family: "Manrope",
    fonts: [
      { src: path.join(fontDir, "Manrope-Regular.ttf"), fontWeight: 400 },
      { src: path.join(fontDir, "Manrope-Bold.ttf"), fontWeight: 700 },
      { src: path.join(fontDir, "Manrope-ExtraBold.ttf"), fontWeight: 800 },
    ],
  });
  Font.register({
    family: "SourceSans",
    fonts: [
      { src: path.join(fontDir, "SourceSans3-Regular.ttf"), fontWeight: 400 },
      { src: path.join(fontDir, "SourceSans3-SemiBold.ttf"), fontWeight: 600 },
    ],
  });
  Font.registerHyphenationCallback((w) => [w]);
  fontsRegistered = true;
}

const C = { primary: "#4F46E5", text: "#0F172A", sub: "#64748B", border: "#E2E8F0", cyan: "#06B6D4", strong: "#22C55E", attention: "#F59E0B", critical: "#F43F5E", bg: "#F8FAFC" };
const s = StyleSheet.create({
  page: { padding: 40, fontFamily: "SourceSans", fontSize: 10, color: C.text, lineHeight: 1.4 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 2, borderBottomColor: C.primary, paddingBottom: 12, marginBottom: 16 },
  h1: { fontFamily: "Manrope", fontWeight: 800, fontSize: 20 },
  h2: { fontFamily: "Manrope", fontWeight: 700, fontSize: 13, marginTop: 14, marginBottom: 6 },
  muted: { color: C.sub },
  card: { backgroundColor: C.bg, borderRadius: 8, padding: 12, flexDirection: "row", gap: 16, alignItems: "center" },
  row: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.border, paddingVertical: 4, alignItems: "center" },
  th: { fontFamily: "Manrope", fontWeight: 700, fontSize: 8, color: C.sub, textTransform: "uppercase" },
  action: { borderWidth: 1, borderColor: C.border, borderRadius: 8, padding: 10, marginBottom: 8 },
  footer: { position: "absolute", bottom: 24, left: 40, right: 40, fontSize: 8, color: C.sub, flexDirection: "row", justifyContent: "space-between" },
});

const STATUS_COLOR = { matched: C.strong, weak: C.attention, missing: C.critical } as const;
const STATUS_LABEL = { matched: "Matched", weak: "Weak", missing: "Missing" } as const;

export interface ReportData {
  attemptId: string;
  studentName: string;
  college: string | null;
  role: string;
  isCustomRole: boolean;
  takenAt: string;
  result: AttemptResult;
  insights: AttemptInsights | null;
  declining: string[];
  trendsUpdatedAt: string | null;
}

function ScoreRing({ value }: { value: number }) {
  const size = 84;
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.border} strokeWidth={8} />
        <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.cyan} strokeWidth={8} strokeLinecap="round" strokeDasharray={`${(circ * value) / 100} ${circ}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </Svg>
      <View style={{ position: "absolute", top: 0, left: 0, width: size, height: size, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 20 }}>{value}%</Text>
      </View>
    </View>
  );
}

const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

function ReportDocument({ d }: { d: ReportData }) {
  const { result } = d;
  const matched = result.rows.filter((r) => r.status === "matched");
  const weak = result.rows.filter((r) => r.status === "weak");
  const missing = result.rows.filter((r) => r.status === "missing");
  const delta = deltaLabel(result.delta, result.previous_date);
  const logo = fs.readFileSync(path.join(root, "public", "brand", "logo.png"));
  const rising = result.rows.filter((r) => r.trend === "rising").map((r) => r.skill);
  const stable = result.rows.filter((r) => r.trend !== "rising" && r.trend !== "declining").map((r) => r.skill);
  return (
    <Document title={`DIAGNASSIS readiness report - ${d.role}`} author="DIAGNASSIS" creator="DIAGNASSIS">
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <Image src={logo} style={{ height: 34 }} />
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ fontFamily: "Manrope", fontWeight: 700 }}>Readiness Report</Text>
            <Text style={s.muted}>Ref DGN-{d.attemptId.slice(0, 6).toUpperCase()}-{result.score}</Text>
          </View>
        </View>
        <Text style={s.h1}>{d.role}</Text>
        <Text style={s.muted}>{d.studentName}{d.college ? ` · ${d.college}` : ""} · Taken {fmt(d.takenAt)} · {result.tested_count} skills tested · {result.question_count} questions</Text>
        {d.isCustomRole ? <Text style={{ color: C.attention, marginTop: 4 }}>Requirements for this role were estimated by AI and may be less precise than curated roles.</Text> : null}

        <View style={[s.card, { marginTop: 12 }]}>
          <ScoreRing value={result.score} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: "Manrope", fontWeight: 700, fontSize: 13 }}>{result.band}{delta ? `  ·  ${delta}` : ""}</Text>
            <Text style={{ marginTop: 3 }}>{BAND_COPY[result.band].text}</Text>
            <Text style={[s.muted, { marginTop: 3 }]}>{matched.length} matched · {weak.length} weak · {missing.length} missing</Text>
          </View>
        </View>

        {d.insights?.summary ? <Text style={{ marginTop: 8 }}>{d.insights.summary}</Text> : null}

        <Text style={s.h2}>Score breakdown</Text>
        <View style={[s.row, { borderBottomColor: C.text }]}>
          <Text style={[s.th, { flex: 3 }]}>Skill</Text><Text style={[s.th, { flex: 1 }]}>Weight</Text><Text style={[s.th, { flex: 1 }]}>Priority</Text>
          <Text style={[s.th, { flex: 1.2 }]}>Your level</Text><Text style={[s.th, { flex: 1.2 }]}>Status</Text><Text style={[s.th, { flex: 1, textAlign: "right" }]}>Points</Text>
        </View>
        {[...result.rows].sort((a, b) => b.weight - a.weight).map((r) => (
          <View key={r.skill} style={s.row} wrap={false}>
            <Text style={{ flex: 3, fontWeight: 600 }}>{r.skill}</Text>
            <Text style={{ flex: 1 }}>{Math.round(r.weight)}%</Text>
            <Text style={{ flex: 1, textTransform: "capitalize" }}>{r.priority}</Text>
            <Text style={{ flex: 1.2 }}>{r.tested ? `${r.proficiency}%` : "Not claimed"}</Text>
            <Text style={{ flex: 1.2, color: STATUS_COLOR[r.status], fontWeight: 600 }}>{STATUS_LABEL[r.status]}</Text>
            <Text style={{ flex: 1, textAlign: "right" }}>{r.points} / {Math.round(r.weight)}</Text>
          </View>
        ))}

        <Text style={s.h2}>Market trend insights</Text>
        <Text>Rising: {rising.join(", ") || "None right now"}</Text>
        <Text>Stable: {stable.join(", ") || "None"}</Text>
        <Text>Declining: {d.declining.join(", ") || "None"}</Text>
        {d.insights?.trend_summary ? <Text style={{ marginTop: 4 }}>{d.insights.trend_summary}</Text> : null}
        <Text style={[s.muted, { marginTop: 4, fontSize: 8 }]}>Trends are AI-assisted estimates{d.trendsUpdatedAt ? `, last reviewed ${fmt(d.trendsUpdatedAt)}` : ""}; they are not live job-listing counts.</Text>

        {d.insights && d.insights.actions.length > 0 ? (
          <View break>
            <Text style={s.h2}>Your top {d.insights.actions.length} things to work on</Text>
            {d.insights.actions.map((a, i) => (
              <View key={a.skill} style={s.action} wrap={false}>
                <Text style={{ fontFamily: "Manrope", fontWeight: 700, fontSize: 11 }}>{i + 1}. {a.skill}  <Text style={{ color: STATUS_COLOR[a.status === "missing" ? "missing" : "weak"], fontSize: 9 }}>{STATUS_LABEL[a.status]} · {a.priority} priority · {trendLabel(a.trend)}</Text></Text>
                <Text style={{ marginTop: 3 }}>{a.why}</Text>
                <Text style={{ marginTop: 3, fontWeight: 600 }}>Next step: <Text style={{ fontWeight: 400 }}>{a.next_step}</Text></Text>
                {a.resources.map((r) => (
                  <Text key={r.title} style={s.muted}>• {r.title} (search: “{r.search_query}”)</Text>
                ))}
              </View>
            ))}
            {!d.insights.ai_generated ? <Text style={[s.muted, { fontSize: 8 }]}>Standard guidance was used because AI-written advice was unavailable when this result was generated.</Text> : null}
          </View>
        ) : null}

        <View style={s.footer} fixed>
          <Text>DIAGNASSIS · Guidance based on your answers; not a guarantee of selection by any employer.</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export async function renderReportPdf(data: ReportData): Promise<Uint8Array> {
  registerFonts();
  const buf = await renderToBuffer(<ReportDocument d={data} />);
  return new Uint8Array(buf);
}
