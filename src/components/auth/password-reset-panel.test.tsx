import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PasswordResetPanel } from "./password-reset-panel";

const fixture = vi.hoisted(() => ({
  listener: null as null | ((event: string, session: { user: { id: string } } | null) => void),
  exchangeCodeForSession: vi.fn(), getUser: vi.fn(), updateUser: vi.fn(), unsubscribe: vi.fn(),
}));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: {
  ...fixture,
  onAuthStateChange: (listener: typeof fixture.listener) => { fixture.listener = listener; return { data: { subscription: { unsubscribe: fixture.unsubscribe } } }; },
} }) }));
afterEach(() => { cleanup(); vi.clearAllMocks(); window.history.replaceState(null, "", "/"); fixture.listener = null; });

function resetCode(event: "PASSWORD_RECOVERY" | "SIGNED_IN" = "PASSWORD_RECOVERY") {
  window.history.replaceState(null, "", "/auth/reset?code=fixture&next=%2Fsay-it-back%3Fchallenge%3Dfriend");
  fixture.exchangeCodeForSession.mockImplementation(async () => {
    fixture.listener?.(event, { user: { id: "recovery-user" } });
    return { data: { user: { id: "recovery-user" }, session: { user: { id: "recovery-user" } } }, error: null };
  });
}

describe("authenticated password recovery", () => {
  it("rejects ordinary sign-in codes and missing recovery sessions", async () => {
    resetCode("SIGNED_IN");
    render(<PasswordResetPanel next="/say-it-back?challenge=friend" emailReady />);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("reset link expired"));
    expect(screen.queryByLabelText("New password")).not.toBeInTheDocument();
    expect(fixture.updateUser).not.toHaveBeenCalled();
  });

  it("requires the same authenticated user before changing the password", async () => {
    resetCode();
    fixture.getUser.mockResolvedValue({ data: { user: { id: "different-user" } }, error: null });
    render(<PasswordResetPanel next="/say-it-back?challenge=friend" emailReady />);
    fireEvent.change(await screen.findByLabelText("New password"), { target: { value: "fixture-password-2" } });
    fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "fixture-password-2" } });
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("reset session ended"));
    expect(fixture.updateUser).not.toHaveBeenCalled();
  });

  it("updates a verified recovery session and retains the challenge return", async () => {
    resetCode();
    fixture.getUser.mockResolvedValue({ data: { user: { id: "recovery-user" } }, error: null });
    fixture.updateUser.mockResolvedValue({ error: null });
    render(<PasswordResetPanel next="/say-it-back?challenge=friend" emailReady />);
    fireEvent.change(await screen.findByLabelText("New password"), { target: { value: "fixture-password-2" } });
    fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "fixture-password-2" } });
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));
    await waitFor(() => expect(fixture.updateUser).toHaveBeenCalledWith({ password: "fixture-password-2" }));
    expect(await screen.findByRole("link", { name: "Continue playing" })).toHaveAttribute("href", "/say-it-back?challenge=friend");
    expect(fixture.exchangeCodeForSession).toHaveBeenCalledTimes(1);
  });
});
