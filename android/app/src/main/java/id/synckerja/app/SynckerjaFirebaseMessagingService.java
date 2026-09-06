package id.synckerja.app;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.Manifest;
import android.os.Build;
import android.view.View;
import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import android.util.Log;
import java.util.Map;

/**
 * Heads-up + shade: template standar sistem, satu ikon saja.
 * PendingIntent memakai requestCode unik agar extras FCM (url/ticket_id) tidak tertimpa.
 */
public class SynckerjaFirebaseMessagingService extends FirebaseMessagingService {

    private static final String TAG = "SynckerjaFCM";

    @Override
    public void onCreate() {
        super.onCreate();
        AppNotificationChannels.ensureAppNotificationsChannel(this);
    }

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        AppNotificationChannels.ensureAppNotificationsChannel(this);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) {
                Log.w(TAG, "POST_NOTIFICATIONS not granted; shade/heads-up may be blocked. Open app and allow notifications.");
            }
        }

        String channelId = getChannelId(remoteMessage);
        String title = getTitle(remoteMessage);
        String body = getBody(remoteMessage);
        if (title == null) title = getString(R.string.app_name);
        if (body == null) body = "";

        int notificationId = (int) (System.currentTimeMillis() % Integer.MAX_VALUE);

        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        if (remoteMessage.getData() != null) {
            for (Map.Entry<String, String> e : remoteMessage.getData().entrySet()) {
                intent.putExtra(e.getKey(), e.getValue());
            }
        }

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        // requestCode = notificationId agar tiap tap membawa extras yang benar (bukan PendingIntent lama).
        PendingIntent pendingIntent = PendingIntent.getActivity(this, notificationId, intent, flags);

        NotificationCompat.Builder builder =
            new NotificationCompat.Builder(this, channelId)
                .setSmallIcon(R.drawable.ic_notification_small)
                .setContentTitle(title)
                .setContentText(body)
                .setLargeIcon((Bitmap) null)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setColor(ContextCompat.getColor(this, R.color.notification_icon_tint))
                .setAutoCancel(true)
                .setDefaults(NotificationCompat.DEFAULT_ALL)
                .setContentIntent(pendingIntent);

        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (nm == null) {
            Log.e(TAG, "NotificationManager null");
            return;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N && !nm.areNotificationsEnabled()) {
            Log.w(TAG, "App notifications disabled in system settings");
        }

        try {
            Notification notification = builder.build();
            hideSystemRightIcon(notification);
            nm.notify(notificationId, notification);
        } catch (SecurityException e) {
            Log.e(TAG, "nm.notify failed (permission?)", e);
        }
    }

    private void hideSystemRightIcon(Notification notification) {
        int rightIconId = getResources().getIdentifier("right_icon", "id", "android");
        if (rightIconId == 0) return;
        try {
            if (notification.contentView != null) {
                notification.contentView.setViewVisibility(rightIconId, View.INVISIBLE);
            }
            if (notification.bigContentView != null) {
                notification.bigContentView.setViewVisibility(rightIconId, View.INVISIBLE);
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP && notification.headsUpContentView != null) {
                notification.headsUpContentView.setViewVisibility(rightIconId, View.INVISIBLE);
            }
        } catch (Throwable t) {
            Log.w(TAG, "hideSystemRightIcon failed", t);
        }
    }

    private String getChannelId(RemoteMessage remoteMessage) {
        if (remoteMessage.getNotification() != null && remoteMessage.getNotification().getChannelId() != null) {
            return remoteMessage.getNotification().getChannelId();
        }
        if (remoteMessage.getData() != null && remoteMessage.getData().containsKey("channel_id")) {
            return remoteMessage.getData().get("channel_id");
        }
        return MainActivity.NOTIFICATIONS_CHANNEL_ID;
    }

    private String getTitle(RemoteMessage remoteMessage) {
        if (remoteMessage.getNotification() != null && remoteMessage.getNotification().getTitle() != null) {
            return remoteMessage.getNotification().getTitle();
        }
        if (remoteMessage.getData() != null && remoteMessage.getData().containsKey("title")) {
            return remoteMessage.getData().get("title");
        }
        return null;
    }

    private String getBody(RemoteMessage remoteMessage) {
        if (remoteMessage.getNotification() != null && remoteMessage.getNotification().getBody() != null) {
            return remoteMessage.getNotification().getBody();
        }
        if (remoteMessage.getData() != null && remoteMessage.getData().containsKey("body")) {
            return remoteMessage.getData().get("body");
        }
        return null;
    }
}
