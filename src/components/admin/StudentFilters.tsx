"use client";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

export function StudentFilters({ q, role, roles }: { q: string; role: string; roles: string[] }) {
  const router = useRouter();
  const [query, setQuery] = useState(q);
  const [r, setR] = useState(role);
  const go = (nq: string, nr: string) => router.push(`/admin/students?${new URLSearchParams({ ...(nq ? { q: nq } : {}), ...(nr ? { role: nr } : {}) })}`);
  const submit = (e: FormEvent) => { e.preventDefault(); go(query.trim(), r); };
  return (
    <form onSubmit={submit} role="search" className="flex flex-wrap items-center gap-3">
      <div className="relative min-w-60 flex-1">
        <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search students by name, email or college" placeholder="Search by name, email or college" maxLength={80} className="w-full rounded-md border border-border bg-surface py-2.5 pl-10 pr-3 text-[15px] outline-none focus:border-primary focus:shadow-[0_0_0_3px_var(--focus-ring)]" />
      </div>
      <select value={r} onChange={(e) => { setR(e.target.value); go(query.trim(), e.target.value); }} aria-label="Filter by role" className="rounded-md border border-border bg-surface px-3 py-2.5 text-[15px]"><option value="">All roles</option>{roles.map((x) => <option key={x}>{x}</option>)}</select>
      <Button type="submit">Search</Button>
      {q || role ? <Button variant="ghost" onClick={() => { setQuery(""); setR(""); router.push("/admin/students"); }}><Icon name="x" size={16} />Clear</Button> : null}
    </form>
  );
}
