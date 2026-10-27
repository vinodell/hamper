/** Cancel one caller's wait while preserving the request for other consumers. */
export function waitForSharedRequest<T>(
  promise: Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted)
    return Promise.reject(new DOMException("Запрос отменён", "AbortError"));
  return new Promise<T>((resolve, reject) => {
    const abort = () =>
      reject(new DOMException("Запрос отменён", "AbortError"));
    signal.addEventListener("abort", abort, { once: true });
    promise.then(resolve, reject).finally(() => {
      signal.removeEventListener("abort", abort);
    });
  });
}
