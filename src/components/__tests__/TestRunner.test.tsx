// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const replace = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ rpc }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("next/image", () => ({ default: (p: { alt: string }) => <span role="img" aria-label={p.alt} /> }));

import { TestRunner, type RunnerQuestion } from "@/components/student/TestRunner";

const qs: RunnerQuestion[] = [
  { position: 0, skill: "React", prompt: "What causes a re-render?", options: ["A", "B", "C", "D"], selected: null, flagged: false },
  { position: 1, skill: "React", prompt: "Why use keys?", options: ["E", "F", "G", "H"], selected: null, flagged: false },
];

beforeEach(() => {
  rpc.mockReset().mockResolvedValue({ error: null });
  replace.mockReset();
  Object.defineProperty(window.navigator, "onLine", { value: true, configurable: true });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 200 })));
  window.scrollTo = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("TestRunner", () => {
  it("autosaves the selected option through the save_answer RPC", async () => {
    const user = userEvent.setup();
    render(<TestRunner attemptId="a1" role="Frontend Developer" custom={false} questions={qs} startAt={0} resumed={false} />);
    await user.click(screen.getByRole("radio", { name: /B/ }));
    await waitFor(() => expect(rpc).toHaveBeenCalledWith("save_answer", { p_attempt: "a1", p_position: 0, p_selected: 1, p_flagged: null }));
    expect(screen.getByRole("radio", { name: /B/ })).toHaveAttribute("aria-checked", "true");
  });

  it("saves flags and navigates between questions", async () => {
    const user = userEvent.setup();
    render(<TestRunner attemptId="a1" role="Frontend Developer" custom={false} questions={qs} startAt={0} resumed={false} />);
    await user.click(screen.getByRole("button", { name: /Flag for review/ }));
    await waitFor(() => expect(rpc).toHaveBeenCalledWith("save_answer", expect.objectContaining({ p_position: 0, p_flagged: true, p_selected: null })));
    await user.click(screen.getByRole("button", { name: /Next/ }));
    expect(screen.getByText("Why use keys?")).toBeInTheDocument();
  });

  it("keeps answers queued while offline and flushes them when the connection returns", async () => {
    const user = userEvent.setup();
    render(<TestRunner attemptId="a1" role="Frontend Developer" custom={false} questions={qs} startAt={0} resumed={false} />);
    Object.defineProperty(window.navigator, "onLine", { value: false, configurable: true });
    window.dispatchEvent(new Event("offline"));
    await screen.findByText(/Connection lost/);
    await user.click(screen.getByRole("radio", { name: /C/ }));
    expect(rpc).not.toHaveBeenCalled();
    Object.defineProperty(window.navigator, "onLine", { value: true, configurable: true });
    window.dispatchEvent(new Event("online"));
    await waitFor(() => expect(rpc).toHaveBeenCalledWith("save_answer", expect.objectContaining({ p_selected: 2 })));
    await waitFor(() => expect(screen.queryByText(/Connection lost/)).not.toBeInTheDocument());
  });

  it("retries a failed save instead of dropping the answer", async () => {
    const user = userEvent.setup();
    rpc.mockResolvedValueOnce({ error: { message: "network" } }).mockResolvedValue({ error: null });
    render(<TestRunner attemptId="a1" role="Frontend Developer" custom={false} questions={qs} startAt={0} resumed={false} />);
    await user.click(screen.getByRole("radio", { name: /A/ }));
    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(1));
    window.dispatchEvent(new Event("online"));
    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(2));
  });

  it("review lists unanswered questions and submits through the server, then opens the results", async () => {
    const user = userEvent.setup();
    render(<TestRunner attemptId="a1" role="Frontend Developer" custom={false} questions={qs} startAt={0} resumed={false} />);
    await user.click(screen.getByRole("radio", { name: /A/ }));
    await user.click(screen.getByRole("button", { name: /Review and submit/ , hidden: false }));
    expect((await screen.findAllByText(/1 of 2 answered/)).length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Question 2, unanswered")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Submit diagnostic" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/results/a1"));
    const urls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0]);
    expect(urls).toEqual(["/api/diagnostics/a1/submit", "/api/diagnostics/a1/insights"]);
  });

  it("shows a retry state when submission fails and does not navigate", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 500 })));
    render(<TestRunner attemptId="a1" role="Frontend Developer" custom={false} questions={qs} startAt={1} resumed={true} />);
    expect(screen.getByText(/Welcome back/)).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: /Review and submit/ })[0]!);
    await user.click(await screen.findByRole("button", { name: "Submit diagnostic" }));
    expect(await screen.findByText(/We could not build your result/)).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});
