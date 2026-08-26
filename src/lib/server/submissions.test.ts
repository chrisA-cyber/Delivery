import { describe, expect, it } from "vitest";

import { throwSubmissionWriteError } from "@/lib/server/submissions";

describe("line submission write errors", () => {
  it("maps the normalized-body unique boundary to a safe conflict", () => {
    expect(() => throwSubmissionWriteError({
      code: "23505",
      message: "duplicate key violates line_submissions_active_body_hash_idx",
    })).toThrow(expect.objectContaining({
      code: "SUBMISSION_DUPLICATE",
      status: 409,
    }));
  });

  it("keeps unrelated database failures as upstream errors", () => {
    expect(() => throwSubmissionWriteError({ code: "57014" })).toThrow(
      expect.objectContaining({ status: 503 }),
    );
  });
});
