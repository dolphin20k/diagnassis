// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const saveRoleSkills = vi.fn().mockResolvedValue({ ok: true });
vi.mock("@/app/admin/actions", () => ({ saveRoleSkills: (...a: unknown[]) => saveRoleSkills(...a), setRoleActive: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }) }));

import { RoleEditor } from "@/components/admin/RoleEditor";
import { SkillPicker } from "@/components/student/SkillPicker";
import { useState } from "react";
import { ToastProvider } from "@/components/ui/Toast";

afterEach(() => { cleanup(); saveRoleSkills.mockClear(); });

const initial = [
  { skill: "JavaScript", weight: 60, priority: "high" as const, trend: "stable" as const },
  { skill: "Git", weight: 40, priority: "low" as const, trend: "rising" as const, trendChange: "+5%" },
];

describe("RoleEditor weight validation", () => {
  it("blocks saving until the weights total exactly 100% and then saves", async () => {
    const user = userEvent.setup();
    render(<ToastProvider><RoleEditor roleId="0b6f5d3e-1c2a-4f10-9a77-3d9b2c1a8e55" name="Frontend Developer" active reviewed={null} declining={[]} initial={initial} /></ToastProvider>);
    expect(screen.getByText(/^Total 100%/)).toBeInTheDocument();
    const w = screen.getByLabelText("JavaScript weight");
    await user.clear(w);
    await user.type(w, "50");
    expect(screen.getByText(/^Total 90%/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(saveRoleSkills).not.toHaveBeenCalled();
    expect(screen.getAllByRole("alert").some((a) => /must total 100%/.test(a.textContent ?? ""))).toBe(true);
    await user.clear(w);
    await user.type(w, "55");
    await user.clear(screen.getByLabelText("Git weight"));
    await user.type(screen.getByLabelText("Git weight"), "45");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(saveRoleSkills).toHaveBeenCalledWith("0b6f5d3e-1c2a-4f10-9a77-3d9b2c1a8e55", [{ skill: "JavaScript", weight: 55, priority: "high" }, { skill: "Git", weight: 45, priority: "low" }]));
  });

  it("rejects duplicate and empty skill names", async () => {
    const user = userEvent.setup();
    render(<ToastProvider><RoleEditor roleId="0b6f5d3e-1c2a-4f10-9a77-3d9b2c1a8e55" name="R" active reviewed={null} declining={[]} initial={initial} /></ToastProvider>);
    const name = screen.getByLabelText("Skill 2 name");
    await user.clear(name);
    await user.type(name, "javascript");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("A skill appears more than once.")).toBeInTheDocument();
    expect(saveRoleSkills).not.toHaveBeenCalled();
  });
});

function Harness({ start = [] as string[] }) {
  const [v, setV] = useState(start);
  return <><SkillPicker value={v} onChange={setV} catalog={["JavaScript", "React", "Git"]} /><output data-testid="out">{v.join("|")}</output></>;
}

describe("SkillPicker", () => {
  it("adds catalogue skills, custom skills and removes them", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: /React/ }));
    const input = screen.getByRole("textbox");
    await user.type(input, "Rust{Enter}");
    expect(screen.getByTestId("out")).toHaveTextContent("React|Rust");
    await user.click(screen.getByRole("button", { name: "Remove React" }));
    expect(screen.getByTestId("out")).toHaveTextContent("Rust");
  });
  it("de-duplicates case-insensitively and strips unsafe characters", async () => {
    const user = userEvent.setup();
    render(<Harness start={["Git"]} />);
    await user.type(screen.getByRole("textbox"), "git{Enter}");
    expect(screen.getByTestId("out")).toHaveTextContent(/^Git$/);
    await user.type(screen.getByRole("textbox"), "<script>x{Enter}");
    expect(screen.getByTestId("out").textContent).not.toMatch(/[<>]/);
  });
});
