export function envThreadsNumber(): number {
  const threads = process.env.VITE_PUBLIC_THREADS;

  if (!threads || threads === "max") {
    return navigator.hardwareConcurrency;
  } else {
    return parseInt(threads);
  }
}
