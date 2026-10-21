import type { RequestOptions } from "../src/lib/api";

/** Simulate a send state without storing, logging or transmitting form values. */
export function sendMockContact({ signal }: RequestOptions = {}): Promise<{
  ok: true;
}> {
  if (signal?.aborted)
    return Promise.reject(new DOMException("Запрос отменён", "AbortError"));
  return new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
      reject(new DOMException("Запрос отменён", "AbortError"));
    };
    const timeout = setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve({ ok: true });
    }, 350);
    signal?.addEventListener("abort", abort, { once: true });
  });
}
