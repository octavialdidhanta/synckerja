package id.synckerja.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.os.Build;

/** Ensures high-importance channel exists before FCM or local notifications post. */
public final class AppNotificationChannels {

    private AppNotificationChannels() {}

    public static void ensureAppNotificationsChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        NotificationChannel channel =
            new NotificationChannel(
                MainActivity.NOTIFICATIONS_CHANNEL_ID,
                "Notifikasi Aplikasi",
                NotificationManager.IMPORTANCE_HIGH
            );
        channel.setDescription("Komentar, persetujuan tugas, update konten, dan notifikasi lain");
        channel.enableVibration(true);
        channel.setShowBadge(true);
        nm.createNotificationChannel(channel);
    }
}
