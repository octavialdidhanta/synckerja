package id.synckerja.app;

import android.content.Intent;
import android.os.Bundle;
import android.util.Log;
import com.getcapacitor.JSObject;
import java.util.Set;

/**
 * Holds FCM notification tap payload forwarded from {@link MainActivity} intent extras.
 * Custom {@link SynckerjaFirebaseMessagingService} shows local notifications with a direct
 * activity PendingIntent, so Capacitor's {@code pushNotificationActionPerformed} never runs.
 *
 * <p>-Xlint:deprecation (compileSdk 35): generic {@link Bundle} key iteration / {@code get(String)}
 * is still the practical way to mirror arbitrary FCM data keys into JS.
 */
@SuppressWarnings("deprecation")
public final class NotificationLaunchStore {

    private static final String TAG = "NotifLaunch";

    private static JSObject pending;

    private NotificationLaunchStore() {}

    /**
     * If this intent looks like an app-notification tap (same keys as FCM data payload), store for JS.
     */
    public static void captureFromIntent(Intent intent) {
        if (intent == null) return;
        Bundle extras = intent.getExtras();
        if (extras == null) return;

        String openNotifications = getStringExtra(extras, "openNotifications");
        String notificationType = getStringExtra(extras, "notificationType");
        boolean looksLikeAppNotification =
            "true".equals(openNotifications)
                || (notificationType != null && !notificationType.isEmpty());
        if (!looksLikeAppNotification) {
            return;
        }

        Set<String> keys = extras.keySet();
        Log.i(TAG, "[NOTIF_DEBUG][native] capture app-notification tap extras keys=" + keys.size());

        JSObject o = new JSObject();
        for (String key : keys) {
            Object val = extras.get(key);
            if (val == null) continue;
            o.put(key, String.valueOf(val));
        }
        pending = o;
    }

    private static String getStringExtra(Bundle extras, String key) {
        Object v = extras.get(key);
        return v != null ? String.valueOf(v) : null;
    }

    public static JSObject consumePending() {
        JSObject ret = pending;
        pending = null;
        return ret;
    }
}
