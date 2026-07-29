package id.synckerja.app;

import android.content.Context;
import android.content.SharedPreferences;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Holds copied share files until JS reads them via ShareIntentPlugin or clears.
 * Also persists the target route so JS can navigate even if the Capacitor listener is late.
 */
public final class ShareIntentStore {

    public static final class PendingItem {
        public final String absolutePath;
        public final String name;
        public final String mimeType;
        public final long sizeBytes;

        public PendingItem(String absolutePath, String name, String mimeType, long sizeBytes) {
            this.absolutePath = absolutePath;
            this.name = name;
            this.mimeType = mimeType;
            this.sizeBytes = sizeBytes;
        }
    }

    private static final String PREFS = "synckerja_share_intent";
    private static final String KEY_ROUTE = "pending_route";
    private static final String KEY_ERROR = "pending_error";

    private static final List<PendingItem> items = new ArrayList<>();
    private static final Object lock = new Object();
    private static String pendingRoute = null;
    private static String pendingError = null;
    private static Context appContext;

    private ShareIntentStore() {}

    public static void init(Context context) {
        if (context != null) {
            appContext = context.getApplicationContext();
            SharedPreferences prefs = appContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            pendingRoute = prefs.getString(KEY_ROUTE, null);
            pendingError = prefs.getString(KEY_ERROR, null);
        }
    }

    public static void setPendingRoute(String route) {
        synchronized (lock) {
            pendingRoute = route;
            persistRouteLocked(route);
        }
    }

    public static String peekPendingRoute() {
        synchronized (lock) {
            if (pendingRoute != null && !pendingRoute.isEmpty()) return pendingRoute;
            if (appContext != null) {
                return appContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_ROUTE, null);
            }
            return null;
        }
    }

    public static void clearPendingRoute() {
        synchronized (lock) {
            pendingRoute = null;
            persistRouteLocked(null);
        }
    }

    public static void setPendingError(String error) {
        synchronized (lock) {
            pendingError = error;
            persistErrorLocked(error);
        }
    }

    public static String peekPendingError() {
        synchronized (lock) {
            if (pendingError != null && !pendingError.isEmpty()) return pendingError;
            if (appContext != null) {
                return appContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_ERROR, null);
            }
            return null;
        }
    }

    private static void persistRouteLocked(String route) {
        if (appContext == null) return;
        SharedPreferences.Editor ed = appContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit();
        if (route == null || route.isEmpty()) ed.remove(KEY_ROUTE);
        else ed.putString(KEY_ROUTE, route);
        ed.apply();
    }

    private static void persistErrorLocked(String error) {
        if (appContext == null) return;
        SharedPreferences.Editor ed = appContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit();
        if (error == null || error.isEmpty()) ed.remove(KEY_ERROR);
        else ed.putString(KEY_ERROR, error);
        ed.apply();
    }

    public static void setPending(List<PendingItem> next) {
        synchronized (lock) {
            items.clear();
            items.addAll(next);
            pendingError = null;
            persistErrorLocked(null);
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
            pendingRoute = null;
            pendingError = null;
            persistRouteLocked(null);
            persistErrorLocked(null);
        }
    }

    public static boolean hasPending() {
        synchronized (lock) {
            return !items.isEmpty();
        }
    }
}
