package id.synckerja.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.ClipData;
import android.content.ContentResolver;
import android.content.Intent;
import android.database.Cursor;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.OpenableColumns;
import android.util.Log;
import android.view.View;
import android.view.WindowManager;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.PickVisualMediaRequest;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.core.os.BundleCompat;
import com.getcapacitor.BridgeActivity;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;

public class MainActivity extends BridgeActivity {

    private static final String TAG = "MainActivity";
    private static final long MAX_SHARE_BYTES = 10L * 1024 * 1024;

    public static final String LIVECHAT_CHANNEL_ID = "livechat";
    public static final String NOTIFICATIONS_CHANNEL_ID = "notifications";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Edge-to-edge MUST be set before super.onCreate() so the window is configured
        // before the WebView is added. Otherwise WindowInsets stay 0 and content is covered.
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        setStatusBarColorCompat(Color.TRANSPARENT);
        // Custom plugins MUST register before super.onCreate() so Capacitor bridge exposes them
        // to JS (PluginHeaders). Otherwise: "ShareIntent plugin is not implemented on android".
        ActivityResultLauncher<PickVisualMediaRequest> photoPickLauncher =
            registerForActivityResult(
                new ActivityResultContracts.PickMultipleVisualMedia(20),
                uris -> PhotoPickerPlugin.deliverPickerResult(MainActivity.this, uris));
        PhotoPickerPlugin.setPhotoPickLauncher(photoPickLauncher);

        registerPlugin(ZoomDisablePlugin.class);
        registerPlugin(SafeAreaInsetsPlugin.class);
        registerPlugin(NoOverscrollPlugin.class);
        registerPlugin(ShareIntentPlugin.class);
        registerPlugin(PhotoPickerPlugin.class);
        registerPlugin(NotificationLaunchPlugin.class);
        super.onCreate(savedInstanceState);
        // Solid black system navigation bar (3-button / gesture strip) + light icons — re-apply after Bridge.
        applyBlackSystemNavigationBar();
        scheduleNavigationBarReapply();
        createLiveChatNotificationChannel();
        createAppNotificationsChannel();
        NotificationLaunchStore.captureFromIntent(getIntent());
        handleShareIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        NotificationLaunchStore.captureFromIntent(intent);
        handleShareIntent(intent);
    }

    @Override
    public void onResume() {
        super.onResume();
        applyBlackSystemNavigationBar();
        scheduleNavigationBarReapply();
    }

    /** WebView / splash sometimes reset nav bar; re-apply after layout. */
    private void scheduleNavigationBarReapply() {
        View decor = getWindow().getDecorView();
        decor.post(this::applyBlackSystemNavigationBar);
        decor.postDelayed(this::applyBlackSystemNavigationBar, 100);
        decor.postDelayed(this::applyBlackSystemNavigationBar, 400);
    }

    /** Window#setStatusBarColor is deprecated from API 35; still used for WebView edge-to-edge setup. */
    @SuppressWarnings("deprecation")
    private void setStatusBarColorCompat(int color) {
        getWindow().setStatusBarColor(color);
    }

    /** Window#setNavigationBarColor is deprecated from API 35; still used for solid nav bar over WebView. */
    @SuppressWarnings("deprecation")
    private void setNavigationBarColorCompat(int color) {
        getWindow().setNavigationBarColor(color);
    }

    /**
     * Opaque black navigation bar app-wide (not transparent over WebView, which reads as white).
     * Clears APPEARANCE_LIGHT_NAVIGATION_BARS so system buttons stay white/light on black.
     */
    private void applyBlackSystemNavigationBar() {
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        setNavigationBarColorCompat(Color.BLACK);
        WindowInsetsControllerCompat controller =
            WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        if (controller != null) {
            controller.setAppearanceLightNavigationBars(false);
        }
    }

    private void createLiveChatNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm == null) return;
        NotificationChannel channel = new NotificationChannel(
            LIVECHAT_CHANNEL_ID,
            "Live Chat",
            NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("Pesan masuk dari Live Chat (WhatsApp, Instagram, Email)");
        channel.enableVibration(true);
        // Custom sound: add notification_livechat.mp3 to res/raw/ and uncomment:
        // Uri soundUri = Uri.parse("android.resource://" + getPackageName() + "/raw/notification_livechat");
        // channel.setSound(soundUri, new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION).build());
        nm.createNotificationChannel(channel);
    }

    private void createAppNotificationsChannel() {
        AppNotificationChannels.ensureAppNotificationsChannel(this);
    }

    private static Uri getSendStreamUri(Intent intent) {
        Bundle extras = intent.getExtras();
        if (extras == null) return null;
        return BundleCompat.getParcelable(extras, Intent.EXTRA_STREAM, Uri.class);
    }

    private static ArrayList<Uri> getSendMultipleStreams(Intent intent) {
        Bundle extras = intent.getExtras();
        if (extras == null) return new ArrayList<>();
        ArrayList<Uri> list = BundleCompat.getParcelableArrayList(extras, Intent.EXTRA_STREAM, Uri.class);
        return list != null ? list : new ArrayList<>();
    }

    private void handleShareIntent(Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        if (action == null) return;
        if (!Intent.ACTION_SEND.equals(action) && !Intent.ACTION_SEND_MULTIPLE.equals(action)) {
            return;
        }

        ArrayList<Uri> uris = new ArrayList<>();
        if (Intent.ACTION_SEND.equals(action)) {
            Uri stream = getSendStreamUri(intent);
            if (stream != null) uris.add(stream);
            if (intent.getData() != null && !uris.contains(intent.getData())) {
                uris.add(intent.getData());
            }
            ClipData clip = intent.getClipData();
            if (clip != null) {
                for (int i = 0; i < clip.getItemCount(); i++) {
                    Uri u = clip.getItemAt(i).getUri();
                    if (u != null && !uris.contains(u)) uris.add(u);
                }
            }
        } else {
            for (Uri u : getSendMultipleStreams(intent)) {
                if (u != null) uris.add(u);
            }
        }

        if (uris.isEmpty()) {
            Log.w(TAG, "Share intent: no stream URIs");
            return;
        }

        final int maxFiles = 20;
        ContentResolver cr = getContentResolver();
        List<ShareIntentStore.PendingItem> items = new ArrayList<>();
        for (int i = 0; i < uris.size() && items.size() < maxFiles; i++) {
            try {
                ShareIntentStore.PendingItem item = copyUriToCache(uris.get(i), cr);
                if (item != null) items.add(item);
            } catch (IOException e) {
                Log.e(TAG, "copyUriToCache failed", e);
            }
        }
        if (items.isEmpty()) return;
        ShareIntentStore.setPending(items);
        ShareIntentPlugin.notifyShareIntentReceived();
    }

    private String resolveDisplayName(Uri uri, ContentResolver cr) {
        try (Cursor c = cr.query(uri, null, null, null, null)) {
            if (c != null && c.moveToFirst()) {
                int idx = c.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (idx >= 0) {
                    String name = c.getString(idx);
                    if (name != null && !name.isEmpty()) return name;
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "resolveDisplayName", e);
        }
        return "shared";
    }

    private static String extensionForMime(String mime, String displayName) {
        String lower = displayName.toLowerCase();
        if (lower.endsWith(".pdf")) return ".pdf";
        if (lower.endsWith(".png")) return ".png";
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return ".jpg";
        if (lower.endsWith(".webp")) return ".webp";
        if (lower.endsWith(".gif")) return ".gif";
        String m = mime != null ? mime.toLowerCase() : "";
        if ("application/pdf".equals(m)) return ".pdf";
        if ("image/png".equals(m)) return ".png";
        if ("image/webp".equals(m)) return ".webp";
        if ("image/gif".equals(m)) return ".gif";
        return ".jpg";
    }

    private ShareIntentStore.PendingItem copyUriToCache(Uri uri, ContentResolver cr) throws IOException {
        String mime = cr.getType(uri);
        if (mime == null) mime = "application/octet-stream";
        String ml = mime.toLowerCase();
        if (!ml.startsWith("image/") && !"application/pdf".equals(ml)) {
            Log.w(TAG, "skip mime: " + mime);
            return null;
        }

        String displayName = resolveDisplayName(uri, cr);
        String ext = extensionForMime(mime, displayName);
        File dir = new File(getCacheDir(), "incoming_share");
        if (!dir.exists() && !dir.mkdirs()) return null;
        String base = "share_" + System.currentTimeMillis() + "_" + (int) (Math.random() * 1_000_000_000);
        File outFile = new File(dir, base + ext);

        try (InputStream in = cr.openInputStream(uri);
             FileOutputStream out = new FileOutputStream(outFile)) {
            if (in == null) return null;
            byte[] buf = new byte[8192];
            long total = 0;
            int read;
            while ((read = in.read(buf)) != -1) {
                total += read;
                if (total > MAX_SHARE_BYTES) {
                    out.close();
                    //noinspection ResultOfMethodCallIgnored
                    outFile.delete();
                    Log.w(TAG, "skip file larger than max");
                    return null;
                }
                out.write(buf, 0, read);
            }
        }

        return new ShareIntentStore.PendingItem(outFile.getAbsolutePath(), displayName, mime);
    }
}
