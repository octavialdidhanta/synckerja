package id.synckerja.app;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Holds copied share files until JS reads them via ShareIntentPlugin or clears.
 */
public final class ShareIntentStore {

    public static final class PendingItem {
        public final String absolutePath;
        public final String name;
        public final String mimeType;

        public PendingItem(String absolutePath, String name, String mimeType) {
            this.absolutePath = absolutePath;
            this.name = name;
            this.mimeType = mimeType;
        }
    }

    private static final List<PendingItem> items = new ArrayList<>();
    private static final Object lock = new Object();

    private ShareIntentStore() {}

    public static void setPending(List<PendingItem> next) {
        synchronized (lock) {
            items.clear();
            items.addAll(next);
        }
    }

    public static List<PendingItem> snapshot() {
        synchronized (lock) {
            return Collections.unmodifiableList(new ArrayList<>(items));
        }
    }

    public static void clear() {
        synchronized (lock) {
            items.clear();
        }
    }

    public static boolean hasPending() {
        synchronized (lock) {
            return !items.isEmpty();
        }
    }
}
