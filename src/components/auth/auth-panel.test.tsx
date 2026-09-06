import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthPanel } from "@/components/auth/auth-panel";

const auth = vi.hoisted(() => ({
  search: new URLSearchParams(),
  signInWithOtp: vi.fn(),
  signInWithPassword: vi.fn(),
  signInWithOAuth: vi.fn(),
  resetPasswordForEmail: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useSearchParams: () => auth.search }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth }) }));
afterEach(() => { cleanup(); vi.clearAllMocks(); auth.search = new URLSearchParams(); });

describe("connected sign-in recovery", () => {
  it("does not offer unverified email signup or password recovery", () => {
    render(<AuthPanel passwordSignIn />);
    expect(screen.getByRole("status")).toHaveTextContent("New accounts are temporarily unavailable");
    expect(screen.queryByRole("button", { name: "Continue with email" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Already have a password? Sign in" }));
    expect(screen.getByText(/Password reset emails are temporarily unavailable/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Send a reset link/ })).not.toBeInTheDocument();
    expect(auth.signInWithOtp).not.toHaveBeenCalled();
  });

  it("prepares recovery for verified email with the exact challenge return destination", async () => {
    auth.search = new URLSearchParams("next=%2Fsay-it-back%3Fchallenge%3Dfriend");
    auth.resetPasswordForEmail.mockResolvedValue({ error: null });
    render(<AuthPanel emailReady passwordSignIn />);
    fireEvent.click(screen.getByRole("button", { name: "Already have a password? Sign in" }));
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "person@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Forgot password? Send a reset link" }));
    await waitFor(() => expect(auth.resetPasswordForEmail).toHaveBeenCalledWith("person@example.com", { redirectTo: `${window.location.origin}/auth/reset?next=%2Fsay-it-back%3Fchallenge%3Dfriend` }));
    expect(await screen.findByRole("status")).toHaveTextContent("If that address has a password account");
  });

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
    render(<AuthPanel emailReady passwordSignIn />);
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "person@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue with email" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("sending limit"));
    expect(auth.signInWithOtp).toHaveBeenCalledWith({ email: "person@example.com", options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=%2Fsay-it-back%3Fclip%3Dfixture` } });
  });

  it("lets existing password users retry an invalid login without sending email", async () => {
    auth.signInWithPassword.mockResolvedValue({ error: { code: "invalid_credentials" } });
    render(<AuthPanel passwordSignIn />);
    fireEvent.click(screen.getByRole("button", { name: "Already have a password? Sign in" }));
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "person@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "fixture-only" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("did not match"));
    expect(auth.signInWithOtp).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
  });
});
