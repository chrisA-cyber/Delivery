import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthPanel } from "@/components/auth/auth-panel";

const auth = vi.hoisted(() => ({
  search: new URLSearchParams(),
  signInWithOtp: vi.fn(),
  signInWithPassword: vi.fn(),
  signInWithOAuth: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useSearchParams: () => auth.search }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth }) }));
afterEach(() => { cleanup(); vi.clearAllMocks(); auth.search = new URLSearchParams(); });

describe("connected sign-in recovery", () => {
  it("only offers social providers that this environment has enabled", () => {
    render(<AuthPanel enabledProviders={["github"]} />);
    expect(screen.getByRole("button", { name: "Continue with GitHub" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Continue with Google" })).not.toBeInTheDocument();
  });

  it("explains failed magic links and preserves the intended scene for guest play", () => {
    auth.search = new URLSearchParams("error=callback&next=%2Fsay-it-back%3Fclip%3Dfixture");
    render(<AuthPanel />);
    expect(screen.getByRole("alert")).toHaveTextContent("different browser");
    expect(screen.getByRole("link", { name: "Keep playing as guest" })).toHaveAttribute("href", "/say-it-back?clip=fixture");
  });

  it("shows a useful sending-limit recovery while keeping the original return path", async () => {
    auth.search = new URLSearchParams("next=%2Fsay-it-back%3Fclip%3Dfixture");
    auth.signInWithOtp.mockResolvedValue({ error: { code: "over_email_send_rate_limit" } });
    render(<AuthPanel />);
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "person@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Email me a magic link" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("sending limit"));
    expect(auth.signInWithOtp).toHaveBeenCalledWith({ email: "person@example.com", options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=%2Fsay-it-back%3Fclip%3Dfixture` } });
  });

  it("lets existing password users retry an invalid login without sending email", async () => {
    auth.signInWithPassword.mockResolvedValue({ error: { code: "invalid_credentials" } });
    render(<AuthPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Already have a password? Sign in" }));
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "person@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "fixture-only" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("did not match"));
    expect(auth.signInWithOtp).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
  });
});
