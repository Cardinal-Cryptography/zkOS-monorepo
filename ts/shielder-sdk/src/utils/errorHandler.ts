import { ShielderCallbacks, ShielderOperation } from "@/client/types";
import { OutdatedSdkError, AccountNotOnChainError } from "@/errors";

/**
 * Handles errors in a consistent way across the Shielder SDK.
 * Checks for specific error types and calls appropriate callbacks.
 *
 * @param error - The error that occurred
 * @param callbacks - The callbacks object containing error handlers
 * @param stage - The stage where the error occurred
 * @param operation - The operation being performed when the error occurred
 */
export function handleShielderError(
  error: unknown,
  callbacks: ShielderCallbacks,
  stage: "generation" | "sending" | "syncing",
  operation: ShielderOperation
) {
  if (error instanceof OutdatedSdkError) {
    callbacks.onSdkOutdated(error, stage, operation);
  } else if (error instanceof AccountNotOnChainError) {
    callbacks.onAccountNotOnChain(error, stage, operation);
  } else {
    callbacks.onError?.(error, stage, operation);
  }
}
