/**
 * Attacker-perspective tests. The attacker is a normal signed-in student talking to the database directly
 * (as PostgREST / supabase-js would: role `authenticated`, JWT sub = attacker), bypassing every UI check.
 * Victim = another student, admin = the administrator. Everything runs in a rolled-back transaction.
 */
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.TEST_DATABASE_URL;
if (!url || !/_test$/.test(url)) throw new Error("TEST_DATABASE_URL must point at a disposable database whose name ends in _test");

let c: Client;
beforeAll(async () => { c = new Client({ connectionString: url }); await c.connect(); });
afterAll(async () => { await c.end(); });

async function tx<T>(fn: () => Promise<T>): Promise<T> {
  await c.query("begin");
  try { return await fn(); } finally { await c.query("rollback"); }
}
async function asUser(id: string | null, role: "authenticated" | "anon" = "authenticated") {
  await c.query("reset role");
  await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(id ? { sub: id, role } : { role })]);
  await c.query(`set local role ${role}`);
}
async function asSuper() { await c.query("reset role"); await c.query("select set_config('request.jwt.claims', '', true)"); }
async function denied(sql: string, params: unknown[] = []) {
  await c.query("savepoint sp");
  let err: unknown = null;
  try { await c.query(sql, params); } catch (e) { err = e; }
  await c.query("rollback to sp");
  if (!err) throw new Error(`ATTACK SUCCEEDED (expected denial): ${sql}`);
  return String((err as Error).message);
}
/** Statement that must either error or touch zero rows. */
async function noEffect(sql: string, params: unknown[] = []) {
  await c.query("savepoint sp");
  try { const r = await c.query(sql, params); await c.query("rollback to sp"); if ((r.rowCount ?? 0) !== 0) throw new Error(`ATTACK AFFECTED ${r.rowCount} ROWS: ${sql}`); }
  catch (e) { await c.query("rollback to sp"); if (String((e as Error).message).startsWith("ATTACK")) throw e; }
}
const mk = async (email: string, name: string) => {
  await asSuper();
  return (await c.query("insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id", [email, JSON.stringify({ full_name: name })])).rows[0].id as string;
};
const SKILLS = ["JavaScript", "React", "HTML & CSS", "Git", "REST APIs"];
async function ready(id: string) {
  await asUser(id);
  const role = (await c.query("select id from public.roles where name = 'Frontend Developer'")).rows[0].id;
  await c.query("update public.profiles set full_name='S', college='C', branch='CSE', year_of_study='4th', skills=$2, target_role_id=$3, details_completed=true where id=$1", [id, SKILLS, role]);
  await c.query("select public.accept_policies(array(select id from public.pending_policies()))");
  return role as string;
}
async function world() {
  const attacker = await mk("attacker@t.dev", "Attacker");
  const victim = await mk("victim@t.dev", "Victim");
  const admin = await mk("admin@t.dev", "Admin");
  await asSuper();
  await c.query("update public.profiles set role='admin' where id=$1", [admin]);
  const role = await ready(victim);
  await ready(attacker);
  await asUser(victim);
  const attempt = (await c.query("select public.start_attempt($1,null,$2) as id", [role, SKILLS])).rows[0].id as string;
  await c.query("select public.save_answer($1,0,1,null)", [attempt]);
  await c.query("select public.submit_attempt($1)", [attempt]);
  const att2Role = role;
  await asSuper();
  await c.query("insert into public.feedback (user_id, kind, rating, message) values ($1,'general',5,'victim private feedback')", [victim]);
  await c.query("insert into public.deletion_requests (user_id, student_name, student_email, attempt_count) values ($1,'Victim','victim@t.dev',1)", [victim]);
  await c.query("insert into public.reports (user_id, attempt_id, storage_key, size_bytes) values ($1,$2,$3,1234)", [victim, attempt, `reports/${victim}/${attempt}.pdf`]);
  return { attacker, victim, admin, attempt, role: att2Role };
}

describe("A. cross-user data access (IDOR) straight against the database", () => {
  it("attacker cannot read any other user's rows in any user-owned table", async () => {
    await tx(async () => {
      const w = await world();
      await asUser(w.attacker);
      const tables: [string, string][] = [
        ["profiles", "id"], ["attempts", "user_id"], ["feedback", "user_id"], ["notifications", "user_id"],
        ["policy_acceptances", "user_id"], ["deletion_requests", "user_id"], ["reports", "user_id"],
      ];
      for (const [t, col] of tables) {
        const r = await c.query(`select count(*)::int n from public.${t} where ${col} = $1`, [w.victim]);
        expect(r.rows[0].n, `${t} leaks victim rows`).toBe(0);
      }
      expect((await c.query("select count(*)::int n from public.attempt_questions where attempt_id = $1", [w.attempt])).rows[0].n).toBe(0);
      expect((await c.query("select count(*)::int n from public.attempts where id = $1", [w.attempt])).rows[0].n).toBe(0);
    });
  });
  it("attacker sees only their own profile when listing everything", async () => {
    await tx(async () => {
      const w = await world();
      await asUser(w.attacker);
      const r = await c.query("select id from public.profiles");
      expect(r.rows.map((x) => x.id)).toEqual([w.attacker]);
    });
  });
  it("admin-only tables and views return nothing / are denied to the attacker", async () => {
    await tx(async () => {
      const w = await world();
      await asUser(w.attacker);
      for (const t of ["activity_log", "ai_requests", "market_research_runs", "skill_suggestions", "custom_role_estimates"]) {
        expect((await c.query(`select count(*)::int n from public.${t}`)).rows[0].n, `${t} readable`).toBe(0);
      }
      await denied("select * from public.question_keys");
    });
  });
  it("RPCs refuse another user's attempt / notification (save_answer, submit_attempt, save_attempt_insights)", async () => {
    await tx(async () => {
      const w = await world();
      await asUser(w.attacker);
      expect(await denied("select public.save_answer($1,0,2,true)", [w.attempt])).toMatch(/attempt_not_found/);
      expect(await denied("select public.submit_attempt($1)", [w.attempt])).toMatch(/attempt_not_found/);
      expect(await denied("select public.save_attempt_insights($1,'{\"x\":1}'::jsonb)", [w.attempt])).toMatch(/attempt_not_found/);
      await asSuper();
      const nid = (await c.query("select id from public.notifications where user_id=$1 limit 1", [w.victim])).rows[0].id;
      await asUser(w.attacker);
      await c.query("select public.mark_notification_read($1)", [nid]);
      await asSuper();
      expect((await c.query("select read_at from public.notifications where id=$1", [nid])).rows[0].read_at).toBeNull();
    });
  });
  it("attacker cannot attach feedback to the victim's attempt or write feedback as the victim", async () => {
    await tx(async () => {
      const w = await world();
      await asUser(w.attacker);
      await denied("insert into public.feedback (user_id, attempt_id, kind, rating) values ($1,$2,'result',1)", [w.attacker, w.attempt]);
      await denied("insert into public.feedback (user_id, kind, rating) values ($1,'general',1)", [w.victim]);
      await denied("update public.feedback set message='pwned'");
      await denied("delete from public.feedback");
    });
  });
});

describe("B. modification and privilege escalation", () => {
  it("cannot modify other users' profiles or own protected columns", async () => {
    await tx(async () => {
      const w = await world();
      await asUser(w.attacker);
      await noEffect("update public.profiles set full_name='HACKED' where id=$1", [w.victim]);
      for (const col of ["role = 'admin'", "email = 'a@b.c'", "id = gen_random_uuid()", "created_at = now()"]) {
        await denied(`update public.profiles set ${col} where id = $1`, [w.attacker]);
      }
      await denied("delete from public.profiles");
      await asSuper();
      expect((await c.query("select role from public.profiles where id=$1", [w.attacker])).rows[0].role).toBe("student");
      expect((await c.query("select full_name from public.profiles where id=$1", [w.victim])).rows[0].full_name).not.toBe("HACKED");
    });
  });
  it("cannot write to attempts, answers, notifications, reports, deletion requests, policies, activity log", async () => {
    await tx(async () => {
      const w = await world();
      await asUser(w.attacker);
      for (const sql of [
        "update public.attempts set score = 100", "update public.attempts set user_id = $1", "delete from public.attempts",
        "insert into public.attempts (user_id, role_name, requirements) values ($1,'x','[]')",
        "update public.attempt_questions set selected_index = 0", "delete from public.attempt_questions",
        "insert into public.notifications (user_id, type, title) values ($1,'platform','phish')", "update public.notifications set read_at = null", "delete from public.notifications",
        "insert into public.reports (user_id, attempt_id, storage_key, size_bytes) values ($1, null, 'x', 1)", "delete from public.reports",
        "insert into public.deletion_requests (user_id, student_name, student_email) values ($1,'x','x')", "update public.deletion_requests set status='approved'",
        "insert into public.policies (type, version, body) values ('terms','9.9',repeat('x',30))", "update public.policies set body='x'", "delete from public.policies",
        "insert into public.policy_acceptances (user_id, policy_id) values ($1, (select id from public.policies limit 1))",
        "insert into public.activity_log (kind, summary) values ('x','x')", "insert into public.ai_requests (kind, ok) values ('x', true)",
        "insert into public.questions (skill_id, prompt, options) values ((select id from public.skills limit 1),'q','[]')", "update public.questions set status='retired'", "delete from public.questions",
        "insert into public.question_keys (question_id, correct_index) values (gen_random_uuid(),0)",
      ]) await noEffectOrDenied(sql, [w.attacker]);
    });
  });
  it("cannot change the catalogue or settings: roles, skills, role_skills, app_settings", async () => {
    await tx(async () => {
      const w = await world();
      await asUser(w.attacker);
      for (const sql of [
        "insert into public.roles (name) values ('Evil')", "update public.roles set is_active=false", "delete from public.roles",
        "insert into public.skills (name) values ('Evil')", "update public.skills set name='x'", "delete from public.skills",
        "insert into public.role_skills (role_id, skill_id, weight, priority) values ((select id from public.roles limit 1),(select id from public.skills limit 1),1,'low')",
        "update public.role_skills set weight=100", "delete from public.role_skills",
        "update public.app_settings set value='999'::jsonb", "delete from public.app_settings",
      ]) await noEffectOrDenied(sql, []);
      await asSuper();
      expect((await c.query("select value from public.app_settings where key='attempt_limit'")).rows[0].value).not.toBe(999);
    });
  });
  it("every admin RPC rejects a normal user, and service-only RPCs are not callable at all", async () => {
    await tx(async () => {
      const w = await world();
      await asUser(w.attacker);
      const admin = [
        "select public.admin_dashboard()", "select public.admin_analytics(30)", "select * from public.admin_list_students()", "select * from public.admin_typed_skills()",
        "select public.admin_set_attempt_limit(50)", "select public.admin_set_role_active(gen_random_uuid(), false)",
        "select public.admin_publish_policy('terms','99.0',repeat('x',40),null)", "select public.admin_create_role('Evil','[]'::jsonb)",
        "select public.admin_save_role_skills(gen_random_uuid(),'[]'::jsonb)", "select public.admin_promote_custom_role(gen_random_uuid())",
        "select public.admin_resolve_deletion(gen_random_uuid(), true)",
      ];
      for (const sql of admin) expect(await denied(sql), sql).toMatch(/forbidden|permission denied/);
      const svc = [
        "select public.create_notification($1,'platform','phish','x')", "select public.notify_admins('platform','phish')",
        "select public.service_apply_role_update(gen_random_uuid(),null,null,'{}','{}','')", "select public.replace_role_skills(gen_random_uuid(),'[]'::jsonb)",
        "select public.handle_new_user()", "select public.on_feedback_created()",
      ];
      for (const sql of svc) expect(await denied(sql, sql.includes("$1") ? [w.victim] : []), sql).toMatch(/permission denied/);
    });
  });
  it("the attacker cannot delete the victim's account through the deletion workflow", async () => {
    await tx(async () => {
      const w = await world();
      await asUser(w.attacker);
      await denied("select public.admin_resolve_deletion((select id from public.deletion_requests limit 1), true)");
      await asSuper();
      expect((await c.query("select count(*)::int n from auth.users where id=$1", [w.victim])).rows[0].n).toBe(1);
      await asUser(w.admin);
      expect(await denied("select public.request_account_deletion('x')")).toMatch(/admin_cannot_delete/);
    });
  });
});

async function noEffectOrDenied(sql: string, params: unknown[]) {
  const p = sql.includes("$1") ? params : [];
  await noEffect(sql, p);
}

describe("C. attempt integrity and input handling", () => {
  it("cannot answer after submission, with invalid options, or skip the one-active-attempt rule", async () => {
    await tx(async () => {
      const w = await world();
      await asUser(w.victim);
      expect(await denied("select public.save_answer($1,0,3,null)", [w.attempt])).toMatch(/attempt_not_found/); // already submitted
      const a2 = (await c.query("select public.start_attempt($1,null,$2) as id", [w.role, SKILLS])).rows[0].id;
      expect(await denied("select public.save_answer($1,0,99,null)", [a2])).toMatch(/invalid_option/);
      expect(await denied("select public.start_attempt($1,null,$2)", [w.role, SKILLS])).toMatch(/attempt_in_progress/);
    });
  });
  it("SQL-injection style input in role / skill names is stored inertly (parameterised, no error, no side effects)", async () => {
    await tx(async () => {
      const w = await world();
      await asUser(w.attacker);
      const evil = "x'); drop table public.profiles; --";
      await denied("select public.start_attempt(null,$1,$2)", [evil, [evil]]); // custom_role_not_estimated, not a syntax error
      await asSuper();
      expect((await c.query("select count(*)::int n from public.profiles")).rows[0].n).toBeGreaterThan(0);
      await asUser(w.attacker);
      await c.query("update public.profiles set college=$2 where id=$1", [w.attacker, evil]);
      await asSuper();
      expect((await c.query("select college from public.profiles where id=$1", [w.attacker])).rows[0].college).toBe(evil);
    });
  });
  it("oversized / malformed JSON and values are rejected by constraints", async () => {
    await tx(async () => {
      const w = await world();
      await asUser(w.attacker);
      expect(await denied("update public.profiles set full_name=repeat('a',5000) where id=$1", [w.attacker])).toMatch(/violates check|too long|value/i);
      expect(await denied("select public.save_attempt_insights((select id from public.attempts limit 1), to_jsonb(repeat('a',70000)))")).toMatch(/attempt_not_found|invalid_insights/);
      expect(await denied("insert into public.feedback (user_id, kind, rating) values ($1,'general',99)", [w.attacker])).toMatch(/violates check/);
    });
  });
});

describe("D. anonymous (no login) access", () => {
  it("anon can read only the published policies and cannot call any RPC", async () => {
    await tx(async () => {
      await world();
      await asUser(null, "anon");
      expect((await c.query("select count(*)::int n from public.policies")).rows[0].n).toBe(2);
      const tables = (await (async () => { await asSuper(); return c.query("select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and relkind='r' and relname <> 'policies'"); })()).rows.map((r) => r.relname as string);
      await asUser(null, "anon");
      for (const t of tables) expect(await denied(`select * from public.${t}`), t).toMatch(/permission denied/);
      await asSuper();
      const fns = (await c.query("select p.oid::regprocedure::text f from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and has_function_privilege('anon', p.oid, 'execute')")).rows;
      expect(fns, "functions executable by anon").toEqual([]);
    });
  });
  it("signed-in users can execute exactly the intended RPC allow-list and nothing else", async () => {
    await asSuper();
    const rows = (await c.query("select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and has_function_privilege('authenticated', p.oid, 'execute') order by 1")).rows.map((r) => r.proname);
    expect(rows).toEqual([
      "accept_policies", "admin_analytics", "admin_create_role", "admin_dashboard", "admin_list_students", "admin_promote_custom_role", "admin_publish_policy",
      "admin_resolve_deletion", "admin_save_role_skills", "admin_set_attempt_limit", "admin_set_role_active", "admin_typed_skills", "cancel_account_deletion", "is_admin",
      "mark_all_notifications_read", "mark_notification_read", "pending_policies", "request_account_deletion", "save_answer", "save_attempt_insights", "start_attempt", "submit_attempt",
    ]);
  });
  it("authenticated has no table-level write privilege on user-owned tables beyond feedback insert; profile updates are limited to an allow-list of columns", async () => {
    await asSuper();
    const cols = (await c.query(`select string_agg(column_name, ',' order by column_name) cols from information_schema.column_privileges where table_schema='public' and table_name='profiles' and grantee='authenticated' and privilege_type='UPDATE'`)).rows[0].cols;
    expect(cols).toBe("branch,college,details_completed,details_skipped,full_name,notification_prefs,skills,target_role_id,target_role_other,year_of_study");
    const r = await c.query(`select table_name, string_agg(privilege_type, ',' order by privilege_type) p from information_schema.table_privileges
      where table_schema='public' and grantee='authenticated' and privilege_type <> 'SELECT' group by table_name order by 1`);
    expect(Object.fromEntries(r.rows.map((x) => [x.table_name, x.p]))).toEqual({
      app_settings: "UPDATE", feedback: "INSERT", role_skills: "DELETE,INSERT,UPDATE", roles: "DELETE,INSERT,UPDATE", skills: "DELETE,INSERT,UPDATE",
    });
  });
});
