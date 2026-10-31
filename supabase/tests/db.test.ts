import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.TEST_DATABASE_URL;
if (!url || !/_test$/.test(url)) {
  throw new Error("TEST_DATABASE_URL must point at a disposable database whose name ends in _test");
}

let c: Client;
beforeAll(async () => {
  c = new Client({ connectionString: url });
  await c.connect();
});
afterAll(async () => {
  await c.end();
});

/** Runs fn inside a transaction that is always rolled back. */
async function tx<T>(fn: () => Promise<T>): Promise<T> {
  await c.query("begin");
  try {
    return await fn();
  } finally {
    await c.query("rollback");
  }
}

async function asUser(id: string | null, role: "authenticated" | "anon" = "authenticated") {
  await c.query("reset role");
  const claims = id ? { sub: id, role } : { role };
  await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
  await c.query(`set local role ${role}`);
}
async function asSuper() {
  await c.query("reset role");
  await c.query("select set_config('request.jwt.claims', '', true)");
}

async function expectFail(sql: string, params: unknown[], pattern: RegExp) {
  await c.query("savepoint sp");
  let err: unknown = null;
  try {
    await c.query(sql, params);
  } catch (e) {
    err = e;
  }
  await c.query("rollback to sp");
  if (!err) throw new Error(`Expected failure but succeeded: ${sql}`);
  expect(String((err as Error).message)).toMatch(pattern);
}

async function createUser(email: string, name: string): Promise<string> {
  await asSuper();
  const r = await c.query(
    "insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id",
    [email, JSON.stringify({ full_name: name })],
  );
  return r.rows[0].id;
}
async function makeAdmin(id: string) {
  await asSuper();
  await c.query("update public.profiles set role = 'admin' where id = $1", [id]);
}
async function completeProfile(id: string, skills: string[], roleName = "Frontend Developer") {
  await asUser(id);
  const role = await c.query("select id from public.roles where name = $1", [roleName]);
  await c.query(
    `update public.profiles set full_name = 'Test Student', college = 'Test College', branch = 'CSE',
       year_of_study = '4th', skills = $2, target_role_id = $3, details_completed = true where id = $1`,
    [id, skills, role.rows[0].id],
  );
  await c.query("select public.accept_policies(array(select id from public.pending_policies()))");
}
async function roleId(name: string) {
  await asSuper();
  return (await c.query("select id from public.roles where name = $1", [name])).rows[0].id as string;
}
/** Answers every question of an attempt using the secret keys (as superuser), `correctFor` decides which skills are right. */
async function answerAll(userId: string, attemptId: string, correctFor: (skill: string) => boolean) {
  await asSuper();
  const qs = await c.query(
    `select aq.position, aq.skill_name, k.correct_index from public.attempt_questions aq
     join public.question_keys k on k.question_id = aq.question_id where aq.attempt_id = $1 order by aq.position`,
    [attemptId],
  );
  await asUser(userId);
  for (const q of qs.rows) {
    const pick = correctFor(q.skill_name) ? q.correct_index : (q.correct_index + 1) % 4;
    await c.query("select public.save_answer($1, $2, $3, null)", [attemptId, q.position, pick]);
  }
  return qs.rows as { position: number; skill_name: string; correct_index: number }[];
}

const FE_SKILLS = ["JavaScript", "React", "HTML & CSS", "Git", "REST APIs"];

describe("seed data", () => {
  it("has 8 curated roles whose weights each total exactly 100", async () => {
    await asSuper();
    const r = await c.query(
      `select r.name, sum(rs.weight) as total from public.roles r
       join public.role_skills rs on rs.role_id = r.id group by r.name`,
    );
    expect(r.rowCount).toBe(8);
    for (const row of r.rows) expect(Number(row.total)).toBe(100);
  });
  it("has seed questions, each with a key", async () => {
    await asSuper();
    const r = await c.query(
      `select count(*) as q, count(k.question_id) as k from public.questions q
       left join public.question_keys k on k.question_id = q.id`,
    );
    expect(Number(r.rows[0].q)).toBeGreaterThanOrEqual(40);
    expect(r.rows[0].q).toBe(r.rows[0].k);
  });
  it("publishes terms and privacy policies", async () => {
    await asSuper();
    const r = await c.query("select type, version from public.policies order by type");
    expect(r.rows.map((x) => x.type)).toEqual(["terms", "privacy"]); // enum order
  });
});

describe("security posture", () => {
  it("enables RLS on every public table", async () => {
    await asSuper();
    const r = await c.query(
      `select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`,
    );
    expect(r.rows).toEqual([]);
  });
  it("pins search_path on every SECURITY DEFINER function", async () => {
    await asSuper();
    const r = await c.query(
      `select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.prosecdef
         and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) cfg where cfg like 'search_path=%')`,
    );
    expect(r.rows).toEqual([]);
  });
  it("lets anonymous users read only the published policies", async () => {
    await tx(async () => {
      await asUser(null, "anon");
      expect((await c.query("select count(*) from public.policies")).rows[0].count).toBe("2");
      for (const t of ["profiles", "attempts", "questions", "roles", "notifications", "question_keys", "reports"]) {
        await expectFail(`select * from public.${t}`, [], /permission denied/);
      }
      await expectFail("select public.is_admin()", [], /permission denied/);
      await expectFail("select public.start_attempt(null, 'x', '{}')", [], /permission denied/);
    });
  });
  it("never exposes answer keys to signed-in users", async () => {
    await tx(async () => {
      const u = await createUser("keys@test.dev", "Keys");
      await asUser(u);
      await expectFail("select * from public.question_keys", [], /permission denied/);
      const q = await c.query("select * from public.questions limit 1");
      expect(Object.keys(q.rows[0])).not.toContain("correct_index");
    });
  });
});

describe("profiles and role escalation", () => {
  it("creates a student profile on signup and ignores any role in metadata", async () => {
    await tx(async () => {
      await asSuper();
      const r = await c.query(
        "insert into auth.users (email, raw_user_meta_data) values ('esc@test.dev', '{\"full_name\":\"Esc\",\"role\":\"admin\"}') returning id",
      );
      const p = await c.query("select role, full_name from public.profiles where id = $1", [r.rows[0].id]);
      expect(p.rows[0]).toEqual({ role: "student", full_name: "Esc" });
    });
  });
  it("blocks students from changing role, email or id", async () => {
    await tx(async () => {
      const u = await createUser("a@test.dev", "A");
      await asUser(u);
      await expectFail("update public.profiles set role = 'admin' where id = $1", [u], /permission denied/);
      await expectFail("update public.profiles set email = 'x@y.z' where id = $1", [u], /permission denied/);
      await c.query("update public.profiles set college = 'Mine' where id = $1", [u]);
      await asSuper();
      expect((await c.query("select role, college from public.profiles where id = $1", [u])).rows[0]).toEqual({ role: "student", college: "Mine" });
    });
  });
  it("blocks direct inserts and deletes on protected tables", async () => {
    await tx(async () => {
      const u = await createUser("b@test.dev", "B");
      await asUser(u);
      await expectFail("insert into public.profiles (id, email) values (gen_random_uuid(), 'z@z.z')", [], /permission denied/);
      await expectFail("delete from public.profiles where id = $1", [u], /permission denied/);
      await expectFail("insert into public.attempts (user_id, role_name, requirements) values ($1, 'x', '[]')", [u], /permission denied/);
      await expectFail("insert into public.policies (type, version, body) values ('terms', '9.9', repeat('x', 30))", [], /permission denied/);
    });
  });
  it("students cannot change app settings (RLS filters the row)", async () => {
    await tx(async () => {
      const u = await createUser("s@test.dev", "S");
      await asUser(u);
      const r = await c.query("update public.app_settings set value = '99'::jsonb where key = 'attempt_limit'");
      expect(r.rowCount).toBe(0);
    });
  });
});

describe("diagnostic lifecycle and server-side grading", () => {
  it("requires completed details and accepted policies before starting", async () => {
    await tx(async () => {
      const u = await createUser("d@test.dev", "D");
      const rid = await roleId("Frontend Developer");
      await asUser(u);
      await expectFail("select public.start_attempt($1, null, $2)", [rid, FE_SKILLS], /details_required/);
      await c.query("update public.profiles set details_completed = true, college='C', branch='B', year_of_study='3rd', skills=$2 where id = $1", [u, FE_SKILLS]);
      await expectFail("select public.start_attempt($1, null, $2)", [rid, FE_SKILLS], /policies_not_accepted/);
    });
  });

  it("runs a full attempt, grades on the server and stores a notification", async () => {
    await tx(async () => {
      const u = await createUser("flow@test.dev", "Flow");
      await completeProfile(u, FE_SKILLS);
      const rid = await roleId("Frontend Developer");
      await asUser(u);
      const a = (await c.query("select public.start_attempt($1, null, $2) as id", [rid, FE_SKILLS])).rows[0].id;
      const qs = (await c.query("select count(*) from public.attempt_questions where attempt_id = $1", [a])).rows[0].count;
      expect(Number(qs)).toBe(25); // 5 claimed required skills x 5 questions

      // Students can read their questions but the rows carry no key.
      const visible = await c.query("select aq.*, q.prompt, q.options from public.attempt_questions aq join public.questions q on q.id = aq.question_id where aq.attempt_id = $1 limit 1", [a]);
      expect(visible.rows[0].prompt).toBeTruthy();

      await answerAll(u, a, (skill) => skill === "JavaScript" || skill === "HTML & CSS");
      const res = (await c.query("select public.submit_attempt($1) as r", [a])).rows[0].r;
      // JavaScript 18% + HTML & CSS 12% fully correct, all other tested skills 0%.
      expect(res.score).toBe(30);
      expect(res.band).toBe("Early stage");
      expect(res.tested_count).toBe(5);
      const js = res.rows.find((r: { skill: string }) => r.skill === "JavaScript");
      expect(js).toMatchObject({ proficiency: 100, status: "matched", tested: true });
      const react = res.rows.find((r: { skill: string }) => r.skill === "React");
      expect(react).toMatchObject({ proficiency: 0, status: "weak", tested: true });
      const ts = res.rows.find((r: { skill: string }) => r.skill === "TypeScript");
      expect(ts).toMatchObject({ proficiency: 0, status: "missing", tested: false });

      // Idempotent resubmission returns the stored result.
      const again = (await c.query("select public.submit_attempt($1) as r", [a])).rows[0].r;
      expect(again.score).toBe(30);

      const n = await c.query("select type, title, body from public.notifications where user_id = $1", [u]);
      expect(n.rows).toHaveLength(1);
      expect(n.rows[0].title).toBe("Your Frontend Developer result is ready");
      expect(n.rows[0].body).toContain("Readiness score 30");

      // Answers cannot be changed after submission.
      await expectFail("select public.save_answer($1, 0, 1, null)", [a], /attempt_not_found/);
    });
  });

  it("computes the delta against the previous attempt for the same role", async () => {
    await tx(async () => {
      const u = await createUser("delta@test.dev", "Delta");
      await completeProfile(u, FE_SKILLS);
      const rid = await roleId("Frontend Developer");
      const run = async (good: boolean) => {
        await asUser(u);
        const a = (await c.query("select public.start_attempt($1, null, $2) as id", [rid, FE_SKILLS])).rows[0].id;
        await answerAll(u, a, () => good);
        return (await c.query("select public.submit_attempt($1) as r", [a])).rows[0].r;
      };
      const first = await run(false);
      expect(first.score).toBe(0);
      expect(first.delta).toBeNull();
      const second = await run(true);
      // 18+17+12+7+10 = 64
      expect(second.score).toBe(64);
      expect(second.delta).toBe(64);
      expect(second.band).toBe("Competitive");
    });
  });

  it("enforces one in-progress attempt, the attempt limit and valid inputs", async () => {
    await tx(async () => {
      const u = await createUser("lim@test.dev", "Lim");
      await completeProfile(u, FE_SKILLS);
      const rid = await roleId("Frontend Developer");
      await asUser(u);
      const a = (await c.query("select public.start_attempt($1, null, $2) as id", [rid, FE_SKILLS])).rows[0].id;
      await expectFail("select public.start_attempt($1, null, $2)", [rid, FE_SKILLS], /attempt_in_progress/);
      await expectFail("select public.save_answer($1, 0, 7, null)", [a], /invalid_option/);
      await c.query("select public.submit_attempt($1)", [a]);
      await asSuper();
      await c.query("update public.app_settings set value = '1'::jsonb where key = 'attempt_limit'");
      await asUser(u);
      await expectFail("select public.start_attempt($1, null, $2)", [rid, FE_SKILLS], /attempt_limit_reached/);
    });
  });

  it("rejects attempts with nothing testable and unknown custom roles", async () => {
    await tx(async () => {
      const u = await createUser("nt@test.dev", "NT");
      await completeProfile(u, ["Cobol"]);
      const rid = await roleId("Frontend Developer");
      await asUser(u);
      await expectFail("select public.start_attempt($1, null, $2)", [rid, ["Cobol"]], /no_testable_skills/);
      await expectFail("select public.start_attempt(null, 'Underwater Welder', $1)", [["Git"]], /custom_role_not_estimated/);
      await expectFail("select public.start_attempt(null, null, $1)", [["Git"]], /role_required/);
    });
  });

  it("supports a custom (AI-estimated) role through the stored estimate", async () => {
    await tx(async () => {
      const u = await createUser("cust@test.dev", "Cust");
      await completeProfile(u, ["Git", "SQL"]);
      await asSuper();
      await c.query(
        `insert into public.custom_role_estimates (name, name_key, requirements)
         values ('Game Developer', 'game developer', $1::jsonb)`,
        [JSON.stringify([
          { skill: "SQL", weight: 60, priority: "high", trend: "stable" },
          { skill: "Git", weight: 40, priority: "low", trend: "stable" },
        ])],
      );
      await asUser(u);
      const a = (await c.query("select public.start_attempt(null, '  game   developer ', $1) as id", [["Git", "SQL"]])).rows[0].id;
      await answerAll(u, a, () => true);
      const res = (await c.query("select public.submit_attempt($1) as r", [a])).rows[0].r;
      expect(res.score).toBe(100);
      const row = await c.query("select is_custom_role, role_name from public.attempts where id = $1", [a]);
      expect(row.rows[0]).toEqual({ is_custom_role: true, role_name: "Game Developer" });
    });
  });
});

describe("tenant isolation between students", () => {
  it("hides every other student's data and blocks cross-user writes", async () => {
    await tx(async () => {
      const alice = await createUser("alice@test.dev", "Alice");
      const bob = await createUser("bob@test.dev", "Bob");
      await completeProfile(alice, FE_SKILLS);
      await completeProfile(bob, FE_SKILLS);
      const rid = await roleId("Frontend Developer");
      await asUser(alice);
      const a = (await c.query("select public.start_attempt($1, null, $2) as id", [rid, FE_SKILLS])).rows[0].id;
      await c.query("select public.submit_attempt($1)", [a]);
      await c.query("insert into public.feedback (user_id, attempt_id, kind, rating, message) values ($1, $2, 'result', 5, '')", [alice, a]);

      await asUser(bob);
      expect((await c.query("select count(*) from public.profiles")).rows[0].count).toBe("1");
      for (const t of ["attempts", "attempt_questions", "notifications", "feedback", "reports"]) {
        expect((await c.query(`select count(*) from public.${t}`)).rows[0].count).toBe("0");
      }
      // Bob sees only his own two policy acceptances, never Alice's.
      const acc = await c.query("select distinct user_id from public.policy_acceptances");
      expect(acc.rows).toEqual([{ user_id: bob }]);
      await expectFail("select public.submit_attempt($1)", [a], /attempt_not_found/);
      await expectFail("select public.save_answer($1, 0, 1, null)", [a], /attempt_not_found/);
      await expectFail("select public.save_attempt_insights($1, '{}'::jsonb)", [a], /attempt_not_found/);
      await expectFail("insert into public.feedback (user_id, attempt_id, kind, rating, message) values ($1, $2, 'result', 1, '')", [bob, a], /row-level security/);
      await expectFail("insert into public.feedback (user_id, kind, rating, message) values ($1, 'general', 5, 'forged as alice, long enough')", [alice], /row-level security/);
      // Bob cannot mark Alice's notification as read.
      await asSuper();
      const nid = (await c.query("select id from public.notifications where user_id = $1", [alice])).rows[0].id;
      await asUser(bob);
      await c.query("select public.mark_notification_read($1)", [nid]);
      await asSuper();
      expect((await c.query("select read_at from public.notifications where id = $1", [nid])).rows[0].read_at).toBeNull();
    });
  });
});

describe("administrator capabilities", () => {
  it("lets admins read all students but forbids students from admin RPCs", async () => {
    await tx(async () => {
      const admin = await createUser("admin@test.dev", "Admin");
      const stu = await createUser("stu@test.dev", "Stu");
      await makeAdmin(admin);
      await asUser(stu);
      for (const sql of [
        "select public.admin_dashboard()",
        "select public.admin_analytics(30)",
        "select * from public.admin_list_students()",
        "select public.admin_set_attempt_limit(3)",
        "select public.admin_publish_policy('terms', '9.0', repeat('x', 40), null)",
        "select * from public.admin_typed_skills()",
      ]) await expectFail(sql, [], /forbidden/);
      await asUser(admin);
      expect(Number((await c.query("select count(*) from public.profiles")).rows[0].count)).toBeGreaterThanOrEqual(2);
      const dash = (await c.query("select public.admin_dashboard() as d")).rows[0].d;
      expect(dash.students_total).toBe(1);
      const students = await c.query("select * from public.admin_list_students('stu', null, 10, 0)");
      expect(students.rowCount).toBe(1);
    });
  });

  it("validates role weights (must total 100) and persists valid edits", async () => {
    await tx(async () => {
      const admin = await createUser("admin2@test.dev", "Admin2");
      await makeAdmin(admin);
      const rid = await roleId("Cloud Engineer");
      await asUser(admin);
      const bad = [{ skill: "AWS", weight: 50, priority: "high" }, { skill: "Linux", weight: 40, priority: "high" }];
      await expectFail("select public.admin_save_role_skills($1, $2::jsonb)", [rid, JSON.stringify(bad)], /weights_must_total_100/);
      const good = [
        { skill: "AWS", weight: 60, priority: "high" },
        { skill: "Linux", weight: 30, priority: "medium" },
        { skill: "Brand New Skill", weight: 10, priority: "low" },
      ];
      await c.query("select public.admin_save_role_skills($1, $2::jsonb)", [rid, JSON.stringify(good)]);
      const rows = await c.query("select s.name, rs.weight from public.role_skills rs join public.skills s on s.id = rs.skill_id where rs.role_id = $1 order by rs.weight desc", [rid]);
      expect(rows.rows.map((r) => r.name)).toEqual(["AWS", "Linux", "Brand New Skill"]);
    });
  });

  it("enforces the 100% total at the table level for direct writes", async () => {
    await c.query("begin");
    try {
      await asSuper();
      const rid = await roleId("Cloud Engineer");
      await c.query("update public.role_skills set weight = weight + 5 where role_id = $1 and priority = 'low'", [rid]);
      await expect(c.query("commit")).rejects.toThrow(/Role weights must total 100/);
    } finally {
      await c.query("rollback").catch(() => {});
    }
  });

  it("forces re-acceptance when a new policy version is published and requires increasing versions", async () => {
    await tx(async () => {
      const admin = await createUser("admin3@test.dev", "Admin3");
      const stu = await createUser("stu3@test.dev", "Stu3");
      await makeAdmin(admin);
      await completeProfile(stu, FE_SKILLS);
      await asUser(stu);
      expect((await c.query("select * from public.pending_policies()")).rowCount).toBe(0);
      await asUser(admin);
      await expectFail("select public.admin_publish_policy('privacy', '1.0', repeat('x', 40), null)", [], /version_must_increase/);
      await c.query("select public.admin_publish_policy('privacy', '1.5', repeat('new text ', 10), 'Added retention rule')");
      await asUser(stu);
      const pend = await c.query("select type, version from public.pending_policies()");
      expect(pend.rows).toEqual([{ type: "privacy", version: "1.5" }]);
      const n = await c.query("select title from public.notifications where user_id = $1 and type = 'policy'", [stu]);
      expect(n.rows[0].title).toContain("Privacy Policy updated to version 1.5");
      await expectFail("select public.start_attempt(null, 'x', '{}')", [], /policies_not_accepted/);
      await c.query("select public.accept_policies(array(select id from public.pending_policies()))");
      expect((await c.query("select * from public.pending_policies()")).rowCount).toBe(0);
    });
  });

  it("rejects accepting a stale policy version", async () => {
    await tx(async () => {
      const admin = await createUser("admin4@test.dev", "Admin4");
      const stu = await createUser("stu4@test.dev", "Stu4");
      await makeAdmin(admin);
      await asSuper();
      const old = (await c.query("select id from public.policies where type = 'terms'")).rows[0].id;
      await asUser(admin);
      await c.query("select public.admin_publish_policy('terms', '2.2', repeat('t', 50), null)");
      await asUser(stu);
      await expectFail("select public.accept_policies(array[$1::uuid])", [old], /policy_not_latest/);
    });
  });
});

describe("account deletion", () => {
  it("lets a student request and cancel deletion, and an admin approve it (cascade)", async () => {
    await tx(async () => {
      const admin = await createUser("admin5@test.dev", "Admin5");
      const stu = await createUser("stu5@test.dev", "Stu5");
      await makeAdmin(admin);
      await completeProfile(stu, FE_SKILLS);
      const rid = await roleId("Frontend Developer");
      await asUser(stu);
      const a = (await c.query("select public.start_attempt($1, null, $2) as id", [rid, FE_SKILLS])).rows[0].id;
      await c.query("select public.submit_attempt($1)", [a]);
      const req = (await c.query("select public.request_account_deletion('wrong account') as id")).rows[0].id;
      await expectFail("select public.request_account_deletion('again')", [], /deletion_already_pending/);
      await expectFail("select public.admin_resolve_deletion($1, true)", [req], /forbidden/);
      await c.query("select public.cancel_account_deletion()");
      expect((await c.query("select status from public.deletion_requests where id = $1", [req])).rows[0].status).toBe("cancelled");
      const req2 = (await c.query("select public.request_account_deletion('please') as id")).rows[0].id;

      await asUser(admin);
      const notif = await c.query("select title from public.notifications where user_id = $1 and type = 'deletion'", [admin]);
      expect(notif.rowCount).toBe(2);
      await c.query("select public.admin_resolve_deletion($1, true)", [req2]);
      await asSuper();
      expect((await c.query("select count(*) from auth.users where id = $1", [stu])).rows[0].count).toBe("0");
      expect((await c.query("select count(*) from public.profiles where id = $1", [stu])).rows[0].count).toBe("0");
      expect((await c.query("select count(*) from public.attempts where user_id = $1", [stu])).rows[0].count).toBe("0");
      const kept = await c.query("select status, student_email, user_id from public.deletion_requests where id = $1", [req2]);
      expect(kept.rows[0]).toEqual({ status: "approved", student_email: "stu5@test.dev", user_id: null });
    });
  });

  it("denying a request keeps the account and notifies the student", async () => {
    await tx(async () => {
      const admin = await createUser("admin6@test.dev", "Admin6");
      const stu = await createUser("stu6@test.dev", "Stu6");
      await makeAdmin(admin);
      await asUser(stu);
      const req = (await c.query("select public.request_account_deletion('x') as id")).rows[0].id;
      await asUser(admin);
      await c.query("select public.admin_resolve_deletion($1, false)", [req]);
      await asSuper();
      expect((await c.query("select count(*) from auth.users where id = $1", [stu])).rows[0].count).toBe("1");
      expect((await c.query("select count(*) from public.notifications where user_id = $1", [stu])).rows[0].count).toBe("1");
    });
  });
});

describe("feedback and notifications", () => {
  it("lets admins switch off individual admin notification types", async () => {
    await tx(async () => {
      const admin = await createUser("adminp@test.dev", "AdminP");
      const stu = await createUser("stup@test.dev", "StuP");
      await makeAdmin(admin);
      await asUser(admin);
      await c.query(`update public.profiles set notification_prefs = notification_prefs || '{"deletion":false}'::jsonb where id = $1`, [admin]);
      await asUser(stu);
      await c.query("select public.request_account_deletion('x')");
      await asUser(admin);
      expect((await c.query("select count(*) from public.notifications where user_id = $1 and type = 'deletion'", [admin])).rows[0].count).toBe("0");
    });
  });

  it("validates feedback and alerts admins on low ratings", async () => {
    await tx(async () => {
      const admin = await createUser("admin7@test.dev", "Admin7");
      const stu = await createUser("stu7@test.dev", "Stu7");
      await makeAdmin(admin);
      await asUser(stu);
      await expectFail("insert into public.feedback (user_id, kind, rating, message) values ($1, 'general', 6, 'long enough message')", [stu], /check/);
      await expectFail("insert into public.feedback (user_id, kind, rating, message) values ($1, 'general', 3, 'short')", [stu], /feedback_general_needs_message/);
      await c.query("insert into public.feedback (user_id, kind, rating, topic, message) values ($1, 'general', 2, 'Test questions', 'More questions on Pandas please')", [stu]);
      await asUser(admin);
      const n = await c.query("select title from public.notifications where user_id = $1 and type = 'rating'", [admin]);
      expect(n.rowCount).toBe(1);
      expect((await c.query("select count(*) from public.feedback")).rows[0].count).toBe("1");
    });
  });

  it("respects notification preferences and supports mark-all-read", async () => {
    await tx(async () => {
      const u = await createUser("np@test.dev", "NP");
      await completeProfile(u, FE_SKILLS);
      await asUser(u);
      await c.query(`update public.profiles set notification_prefs = '{"results":false,"report":true,"platform":true,"policy":true}' where id = $1`, [u]);
      const rid = await roleId("Frontend Developer");
      await asUser(u);
      const a = (await c.query("select public.start_attempt($1, null, $2) as id", [rid, FE_SKILLS])).rows[0].id;
      await c.query("select public.submit_attempt($1)", [a]);
      expect((await c.query("select count(*) from public.notifications where user_id = $1", [u])).rows[0].count).toBe("0");
      await asSuper();
      await c.query("select public.create_notification($1, 'platform', 'Hello', 'World')", [u]);
      await asUser(u);
      expect((await c.query("select public.mark_all_notifications_read() as n")).rows[0].n).toBe(1);
    });
  });
});
