/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */
export function envThreadsNumber(): number {
  const threads = (import.meta as any).env.VITE_PUBLIC_THREADS as
    | string
    | undefined;

  if (!threads || threads === "max") {
    return navigator.hardwareConcurrency;
  } else {
    return parseInt(threads);
  }
}
