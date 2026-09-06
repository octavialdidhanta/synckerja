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
 */
@SuppressWarnings("deprecation")
public final class NotificationLaunchStore {

    private static final String TAG = "NotifLaunch";

    private static JSObject pending;

    private NotificationLaunchStore() {}

    /**
     * Capture tap extras when payload looks like an app push (deep link keys or notificationType).
     */
    public static void captureFromIntent(Intent intent) {
        if (intent == null) return;
        Bundle extras = intent.getExtras();
        if (extras == null) return;

        String openNotifications = getStringExtra(extras, "openNotifications");
        String notificationType = getStringExtra(extras, "notificationType");
        String url = getStringExtra(extras, "url");
        String ticketId = getStringExtra(extras, "ticket_id");
        String conversationId = getStringExtra(extras, "conversation_id");

        boolean looksLikeAppNotification =
            "true".equals(openNotifications)
                || (notificationType != null && !notificationType.isEmpty())
                || (url != null && !url.isEmpty())
                || (ticketId != null && !ticketId.isEmpty())
                || (conversationId != null && !conversationId.isEmpty());
        if (!looksLikeAppNotification) {
            return;
        }

        Set<String> keys = extras.keySet();
        Log.i(TAG, "[NOTIF_DEBUG][native] capture push tap extras keys=" + keys.size()
            + " type=" + notificationType + " hasUrl=" + (url != null && !url.isEmpty()));

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
