package id.synckerja.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.os.Build;

/** Ensures high-importance channels exist before FCM or local notifications post. */
public final class AppNotificationChannels {

    private AppNotificationChannels() {}

    public static void ensureAppNotificationsChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;

        NotificationChannel app =
            new NotificationChannel(
                MainActivity.NOTIFICATIONS_CHANNEL_ID,
                "Notifikasi Aplikasi",
                NotificationManager.IMPORTANCE_HIGH
            );
        app.setDescription("Komentar, persetujuan tugas, update konten, dan notifikasi lain");
        app.enableVibration(true);
        app.setShowBadge(true);
        nm.createNotificationChannel(app);

        // Livechat channel must exist even if MainActivity has not run yet (data-only FCM).
        NotificationChannel livechat =
            new NotificationChannel(
                MainActivity.LIVECHAT_CHANNEL_ID,
                "Live Chat",
                NotificationManager.IMPORTANCE_HIGH
            );
        livechat.setDescription("Pesan masuk dari Live Chat (WhatsApp, Instagram, Email)");
        livechat.enableVibration(true);
        livechat.setShowBadge(true);
        nm.createNotificationChannel(livechat);
    }
}
