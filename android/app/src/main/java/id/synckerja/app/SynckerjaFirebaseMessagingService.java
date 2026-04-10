package id.synckerja.app;

import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.drawable.Drawable;
import android.Manifest;
import android.os.Build;
import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import android.util.Log;
import java.util.Map;

/**
 * Custom FCM service: large icon = ic_notification_large (heads-up, shade).
 * Ensures notification channel exists (including before MainActivity runs) so posts are not dropped.
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

        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        if (remoteMessage.getData() != null) {
            for (Map.Entry<String, String> e : remoteMessage.getData().entrySet()) {
                intent.putExtra(e.getKey(), e.getValue());
            }
        }

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, intent, flags);

        NotificationCompat.Builder builder =
            new NotificationCompat.Builder(this, channelId).setSmallIcon(R.drawable.splash_white_logo);

        Bitmap largeIconBitmap = drawableToBitmap(R.drawable.ic_notification_large);
        if (largeIconBitmap != null) {
            builder.setLargeIcon(largeIconBitmap);
        }

        builder.setContentTitle(title != null ? title : getString(R.string.app_name))
            .setContentText(body != null ? body : "")
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body != null ? body : ""))
            .setColor(ContextCompat.getColor(this, R.color.notification_icon_tint))
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setDefaults(NotificationCompat.DEFAULT_SOUND | NotificationCompat.DEFAULT_VIBRATE)
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
            int id = (int) (System.currentTimeMillis() % Integer.MAX_VALUE);
            nm.notify(id, builder.build());
        } catch (SecurityException e) {
            Log.e(TAG, "nm.notify failed (permission?)", e);
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

    private Bitmap drawableToBitmap(int drawableResId) {
        Drawable drawable = ContextCompat.getDrawable(this, drawableResId);
        if (drawable == null) return null;
        int size = (int) (256 * getResources().getDisplayMetrics().density);
        Bitmap bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);
        drawable.setBounds(0, 0, size, size);
        drawable.draw(canvas);
        return bitmap;
    }
}
