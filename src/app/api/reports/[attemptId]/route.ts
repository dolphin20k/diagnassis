import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { putReport, r2Configured, reportExists, reportKey, signedReportUrl } from "@/lib/r2";
import { renderReportPdf } from "@/lib/report/pdf";
import { getApiUser, json, UUID } from "@/lib/server/api";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Report download. Authorization is checked first (RLS: only the owner can read the attempt).
 *  - R2 configured: the PDF is generated once, stored privately in R2, and the browser is redirected
 *    to a 5-minute presigned URL.
 *  - R2 not configured: the PDF is generated on demand and streamed (nothing is stored).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  if (!UUID.test(attemptId)) return json({ error: "invalid_id" }, 400);
  const ctx = await getApiUser();
  if (!ctx) return json({ error: "unauthenticated" }, 401);

  const [{ data: attempt }, { data: profile }] = await Promise.all([
    ctx.supabase.from("attempts").select("*").eq("id", attemptId).eq("user_id", ctx.user.id).maybeSingle(),
    ctx.supabase.from("profiles").select("full_name,college,notification_prefs").eq("id", ctx.user.id).maybeSingle(),
  ]);
  if (!attempt || attempt.status !== "submitted" || !attempt.result || !attempt.submitted_at || !profile) return json({ error: "attempt_not_found" }, 404);

  const filename = `diagnassis-${attempt.role_name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${attempt.submitted_at.slice(0, 10)}.pdf`;
  const key = reportKey(ctx.user.id, attemptId);
  const useR2 = r2Configured();

  if (useR2 && (await reportExists(key))) {
    return NextResponse.redirect(await signedReportUrl(key, filename), { status: 302, headers: { "Cache-Control": "no-store" } });
  }

  const notifyReady = async () => {
    // One "report ready" notification per attempt (honours the student's notification preferences in SQL).
    const { count } = await ctx.supabase.from("notifications").select("id", { count: "exact", head: true }).eq("attempt_id", attemptId).eq("type", "report");
    if ((count ?? 0) > 0) return;
    const when = new Date(attempt.submitted_at as string).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
    await createAdminClient().rpc("create_notification", {
      p_user: ctx.user.id,
      p_type: "report",
      p_title: "PDF report ready to download",
      p_body: `${attempt.role_name} report from ${when}.`,
      p_attempt: attemptId,
      p_link: `/results/${attemptId}`,
    });
  };

  let pdf: Uint8Array;
  try {
    pdf = await renderReportPdf({
      attemptId,
      studentName: profile.full_name || "Student",
      college: profile.college,
      role: attempt.role_name,
      isCustomRole: attempt.is_custom_role,
      takenAt: attempt.submitted_at,
      result: attempt.result,
      insights: attempt.insights,
      declining: attempt.declining_skills,
      trendsUpdatedAt: attempt.trends_updated_at,
    });
  } catch {
    return json({ error: "report_failed", message: "We could not generate your report. Please try again." }, 500);
  }

  await notifyReady().catch(() => undefined);

  if (useR2) {
    try {
      await putReport(key, pdf);
      const admin = createAdminClient();
      const { data: existing } = await admin.from("reports").select("id").eq("attempt_id", attemptId).maybeSingle();
      if (!existing) {
        await admin.from("reports").insert({ attempt_id: attemptId, user_id: ctx.user.id, storage_key: key, size_bytes: pdf.byteLength });
      }
      return NextResponse.redirect(await signedReportUrl(key, filename), { status: 302, headers: { "Cache-Control": "no-store" } });
    } catch {
      // R2 failure must not block the student: fall through to a direct download.
    }
  }

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
