import "server-only";

import { AppError, ExternalServiceError } from "@/lib/server/api-error";

export interface DatabaseWriteError {
  code?: string;
  message?: string;
}

export function throwSubmissionWriteError(error: DatabaseWriteError): never {
  if (error.code === "23505") {
    throw new AppError(
      "SUBMISSION_DUPLICATE",
      "That line is already in the review queue or catalog. Try a fresh angle.",
      409,
    );
  }
  throw new ExternalServiceError("Supabase", { cause: error });
}
