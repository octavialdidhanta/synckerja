/**
 * Stack of Android hardware back consumers (last registered = first consulted).
 * Used so fullscreen flows (e.g. expense from share) can block history.back().
 */
const consumers: Array<() => boolean> = [];

/** Returns unregister. Consumer returns true if the back press was handled (do not navigate back). */
export function registerAndroidBackConsumer(consumer: () => boolean): () => void {
  consumers.push(consumer);
  return () => {
    const i = consumers.indexOf(consumer);
    if (i >= 0) consumers.splice(i, 1);
  };
}

export function consumeAndroidBackIfHandled(): boolean {
  for (let i = consumers.length - 1; i >= 0; i--) {
    try {
      if (consumers[i]()) return true;
    } catch {
      /* ignore broken consumer */
    }
  }
  return false;
}
