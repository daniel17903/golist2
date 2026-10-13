// Node timers behind the numeric-handle API the sync manager expects.
export const createNodeTimers = () => {
  let nextHandle = 1;
  const handles = new Map<number, ReturnType<typeof setTimeout>>();
  return {
    setTimeout: (callback: () => void, ms: number): number => {
      const handle = nextHandle++;
      handles.set(
        handle,
        setTimeout(() => {
          handles.delete(handle);
          callback();
        }, ms),
      );
      return handle;
    },
    clearTimeout: (handle: number) => {
      const timer = handles.get(handle);
      if (timer !== undefined) {
        clearTimeout(timer);
        handles.delete(handle);
      }
    },
    clearAll: () => {
      handles.forEach((timer) => clearTimeout(timer));
      handles.clear();
    },
  };
};

export const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// Polls `check` until it returns true; throws `describe()` on timeout.
export const waitUntil = async (
  check: () => boolean | Promise<boolean>,
  options: { timeoutMs?: number; intervalMs?: number; describe?: () => string | Promise<string> } = {},
) => {
  const timeoutMs = options.timeoutMs ?? 10_000;
  const intervalMs = options.intervalMs ?? 20;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) {
      return;
    }
    await delay(intervalMs);
  }
  if (await check()) {
    return;
  }
  throw new Error(options.describe ? await options.describe() : `condition not met within ${timeoutMs}ms`);
};
