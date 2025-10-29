type DebouncedFunction<T extends (...args: unknown[]) => unknown> = {
  (...args: Parameters<T>): void;
  cancel: () => void;
  flush: () => void;
  pending: () => boolean;
};

export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait = 1000
): DebouncedFunction<T> {
  let timeoutId: NodeJS.Timeout | null = null;
  let lastArgs: Parameters<T> | null = null;

  const debounced = function (this: unknown, ...args: Parameters<T>) {
    lastArgs = args;

    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      func.apply(this, args);
      timeoutId = null;
      lastArgs = null;
    }, wait);
  } as DebouncedFunction<T>;

  // Cancel any pending execution
  debounced.cancel = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
      lastArgs = null;
    }
  };

  // Execute immediately if pending
  debounced.flush = function (this: unknown) {
    if (timeoutId !== null && lastArgs !== null) {
      clearTimeout(timeoutId);
      func.apply(this, lastArgs);
      timeoutId = null;
      lastArgs = null;
    }
  };

  // Check if execution is pending
  debounced.pending = () => {
    return timeoutId !== null;
  };

  return debounced;
}

export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait = 1000
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  let timeoutId: NodeJS.Timeout | null = null;

  return function (this: unknown, ...args: Parameters<T>) {
    const now = Date.now();
    const timeSinceLastCall = now - lastCall;

    if (timeSinceLastCall >= wait) {
      lastCall = now;
      func.apply(this, args);
    } else {
      // Schedule the next call
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => {
        lastCall = Date.now();
        func.apply(this, args);
        timeoutId = null;
      }, wait - timeSinceLastCall);
    }
  };
}
