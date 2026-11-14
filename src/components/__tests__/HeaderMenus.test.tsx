// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const markOne = vi.fn().mockResolvedValue({ ok: true });
const markAll = vi.fn().mockResolvedValue({ ok: true });
const mk = (i: number, read: boolean) => ({ id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`, user_id: "u", type: "results", title: `Result ${i}`, body: `Body ${i}`, attempt_id: null, link: `/results/${i}`, created_at: new Date().toISOString(), read_at: read ? new Date().toISOString() : null });
const rows = [mk(1, false), mk(2, true)];
const range = vi.fn().mockResolvedValue({ data: rows, error: null });

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push }), usePathname: () => "/dashboard" }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ from: () => ({ select: () => ({ order: () => ({ range }) }) }) }) }));
vi.mock("@/app/(student)/actions", () => ({ markNotificationRead: (...a: unknown[]) => markOne(...a), markAllNotificationsRead: () => markAll() }));

import { NotificationBell, ProfileMenu } from "@/components/layout/HeaderMenus";

afterEach(() => { cleanup(); push.mockClear(); markOne.mockClear(); markAll.mockClear(); });

describe("NotificationBell dropdown", () => {
  it("opens a panel under the bell, marks unread vs read, opens an item, and closes on outside click", async () => {
    const user = userEvent.setup();
    render(<div><NotificationBell unread={1} allHref="/notifications" /><p>outside</p></div>);
    expect(screen.queryByRole("dialog")).toBeNull();
    await user.click(screen.getByRole("button", { name: /Notifications, 1 unread/ }));
    const panel = await screen.findByRole("dialog", { name: "Notifications" });
    await waitFor(() => expect(within(panel).getByText("Result 1")).toBeInTheDocument());
    expect(within(panel).getByText("(unread)")).toBeInTheDocument(); // only the unread one is flagged
    expect(within(panel).getAllByText(/\(unread\)/)).toHaveLength(1);
    expect(within(panel).getByRole("link", { name: /View all notifications/ })).toHaveAttribute("href", "/notifications");

    await user.click(within(panel).getByText("Result 1"));
    expect(markOne).toHaveBeenCalledWith(rows[0]!.id);
    expect(push).toHaveBeenCalledWith("/results/1");
    expect(screen.queryByRole("dialog")).toBeNull();

    await user.click(screen.getByRole("button", { name: /Notifications/ }));
    await screen.findByRole("dialog");
    await user.click(screen.getByText("outside"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});

describe("ProfileMenu popover", () => {
  it("shows name and email with Log out and a profile link for any role", async () => {
    const user = userEvent.setup();
    render(<ProfileMenu name="Tanusree K" email="t@example.com" profileHref="/profile" settingsHref="/settings" />);
    await user.click(screen.getByRole("button", { name: /Account menu for Tanusree K/ }));
    const menu = await screen.findByRole("menu");
    expect(within(menu).getByText("Tanusree K")).toBeInTheDocument();
    expect(within(menu).getByText("t@example.com")).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: /My profile/ })).toHaveAttribute("href", "/profile");
    expect(within(menu).getByRole("menuitem", { name: /Log out/ })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  });
});
