/**
 * Start one async job per item, at most `limit` at a time, in item order, and hand back each
 * job's promise by key. The caller can then walk the items in order and await each result:
 * independent checks overlap while anything that depends on earlier results stays in order.
 */
export function startLimited<T, R>(
  items: readonly T[],
  key: (item: T) => string,
  limit: number,
  run: (item: T) => Promise<R>,
): Map<string, Promise<R>> {
  const jobs = new Map<string, Promise<R>>();
  let active = 0;
  const waiting: Array<() => void> = [];
  const acquire = (): Promise<void> => {
    if (active < limit) {
      active += 1;
      return Promise.resolve();
    }
    return new Promise((resolve) => waiting.push(() => {
      active += 1;
      resolve();
    }));
  };
  const release = () => {
    active -= 1;
    waiting.shift()?.();
  };
  for (const item of items) {
    const id = key(item);
    if (jobs.has(id)) continue;
    const job = acquire().then(() => run(item)).finally(release);
    // Awaited later by the caller; this keeps an early failure from being reported as unhandled.
    job.catch(() => undefined);
    jobs.set(id, job);
  }
  return jobs;
}
