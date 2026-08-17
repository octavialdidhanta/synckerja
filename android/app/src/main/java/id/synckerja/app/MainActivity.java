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
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.widget.FrameLayout;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.PickVisualMediaRequest;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.core.content.ContextCompat;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.core.os.BundleCompat;
import androidx.core.splashscreen.SplashScreen;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginHandle;
import ee.forgr.capacitor.social.login.GoogleProvider;
import ee.forgr.capacitor.social.login.ModifiedMainActivityForSocialLoginPlugin;
import ee.forgr.capacitor.social.login.SocialLoginPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;

public class MainActivity extends BridgeActivity implements ModifiedMainActivityForSocialLoginPlugin {

    private static final String TAG = "MainActivity";
    private static final long MAX_SHARE_BYTES = 10L * 1024 * 1024;
    /**
     * CapCut / Gallery exports often exceed 128MB. Align with Drive upload + download helpers (512MB).
     */
    private static final long MAX_SHARE_VIDEO_BYTES = 512L * 1024 * 1024;

    public static final String LIVECHAT_CHANNEL_ID = "livechat";
    public static final String NOTIFICATIONS_CHANNEL_ID = "notifications";

    /** API 35+: {@code setNavigationBarColor} diabaikan; view ini menutup WebView di zona 3-tombol. */
    private View navigationBarScrim;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Android 12+ SplashScreen API + compat: pastikan cold start tema SplashScreen terpasang.
        SplashScreen.installSplashScreen(this);
        // Edge-to-edge (synckerja-reference): sebelum super.onCreate agar WebView + insets konsisten.
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        /** Cold start: strip status bar putih + ikon gelap sebelum JS/Capacitor StatusBar aktif. */
        applyLightStatusBarAppearance();
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
        registerPlugin(WebViewMediaPlugin.class);
        registerPlugin(ShareIntentPlugin.class);
        registerPlugin(PhotoPickerPlugin.class);
        registerPlugin(NotificationLaunchPlugin.class);
        // Sebelum Bridge/WebView: paksa nav bar opaque hitam (cold start / API 35 edge-to-edge).
        applyBlackSystemNavigationBar();
        ShareIntentStore.init(this);
        super.onCreate(savedInstanceState);
        // Solid black system navigation bar (3-button / gesture strip) + light icons — re-apply after Bridge.
        applyBlackSystemNavigationBar();
        scheduleSystemBarReapply();
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

    /** Required by @capgo/capacitor-social-login for Google authorization intents. */
    @Override
    public void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode >= GoogleProvider.REQUEST_AUTHORIZE_GOOGLE_MIN
            && requestCode < GoogleProvider.REQUEST_AUTHORIZE_GOOGLE_MAX) {
            PluginHandle pluginHandle = getBridge().getPlugin("SocialLogin");
            if (pluginHandle != null) {
                Plugin plugin = pluginHandle.getInstance();
                if (plugin instanceof SocialLoginPlugin) {
                    ((SocialLoginPlugin) plugin).handleGoogleLoginIntent(requestCode, data);
                } else {
                    Log.i(TAG, "Google activity result: plugin is not SocialLoginPlugin");
                }
            } else {
                Log.i(TAG, "Google activity result: SocialLogin plugin handle is null");
            }
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    public void IHaveModifiedTheMainActivityForTheUseWithSocialLoginPlugin() {
        // Marker for Capgo Social Login — must be implemented when MainActivity is customized.
    }

    @Override
    public void onResume() {
        super.onResume();
        applyBlackSystemNavigationBar();
        scheduleSystemBarReapply();
    }

    /**
     * WebView / splash sometimes reset nav bar; re-apply after layout.
     * Status bar diserahkan ke JS ({@code @capacitor/status-bar}) setelah route aktif agar halaman
     * ber-tema gelap (mis. Live Chat) tidak tertimpa putih setiap resume.
     */
    private void scheduleSystemBarReapply() {
        View decor = getWindow().getDecorView();
        decor.post(this::applyBlackSystemNavigationBar);
        decor.postDelayed(this::applyBlackSystemNavigationBar, 100);
        decor.postDelayed(this::applyBlackSystemNavigationBar, 400);
        decor.postDelayed(this::applyBlackSystemNavigationBar, 900);
        decor.postDelayed(this::applyBlackSystemNavigationBar, 1600);
    }

    /** Window#setStatusBarColor is deprecated from API 35; still used for WebView edge-to-edge setup. */
    @SuppressWarnings("deprecation")
    private void setStatusBarColorCompat(int color) {
        getWindow().setStatusBarColor(color);
    }

    /** Putih opak + ikon sistem gelap (jam/baterai). Halaman gelap menimpa lewat @capacitor/status-bar di JS. */
    private void applyLightStatusBarAppearance() {
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        setStatusBarColorCompat(Color.WHITE);
        WindowInsetsControllerCompat controller =
            WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        if (controller != null) {
            controller.setAppearanceLightStatusBars(true);
        }
    }

    /** Window#setNavigationBarColor is deprecated from API 35; still used for solid nav bar over WebView. */
    @SuppressWarnings("deprecation")
    private void setNavigationBarColorCompat(int color) {
        getWindow().setNavigationBarColor(color);
    }

    /**
     * Opaque dark navigation bar (back / home / recent): solid background, not translucent over WebView.
     * {@code setAppearanceLightNavigationBars(false)} → ikon sistem terang di atas latar gelap.
     * API 35/36 mengabaikan {@code setNavigationBarColor}; scrim native menutup WebView abu di zona tombol.
     * Selalu batalkan immersive / hide-navigation (splash plugin atau WebView) agar bilah sistem tetap ada.
     */
    @SuppressWarnings("deprecation")
    private void applyBlackSystemNavigationBar() {
        getWindow().clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
        getWindow().clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_NAVIGATION);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        int navColor = ContextCompat.getColor(this, R.color.system_navigation_bar_background);
        setNavigationBarColorCompat(navColor);
        /**
         * false: di beberapa perangkat + WebView edge-to-edge, contrast enforced menambah lapisan inset
         * mandatory yang tidak selalu selaras dengan env(safe-area) setelah resume → spasi bawah ganjil.
         * Latar hitam di API 35+ memakai {@link #ensureNavigationBarScrim()} bukan contrast scrim sistem.
         */
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            getWindow().setNavigationBarContrastEnforced(false);
        }
        View decor = getWindow().getDecorView();
        int vis = decor.getSystemUiVisibility();
        vis &= ~(View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_IMMERSIVE
            | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            | View.SYSTEM_UI_FLAG_FULLSCREEN
            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
        decor.setSystemUiVisibility(vis);

        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(getWindow(), decor);
        if (controller != null) {
            controller.show(WindowInsetsCompat.Type.navigationBars());
            controller.setAppearanceLightNavigationBars(false);
        }
        ensureNavigationBarScrim(navColor);
        ViewCompat.requestApplyInsets(decor);
    }

    /**
     * Android 15+ (target 16): warna nav bar window diabaikan. WebView sudah di-layout di atas
     * zona 3-tombol; celah itu menampilkan background activity (putih) di belakang ikon terang.
     * View opak di DecorView menutup zona itu tanpa mengubah inset CSS.
     */
    private void ensureNavigationBarScrim(int navColor) {
        View decor = getWindow().getDecorView();
        if (!(decor instanceof ViewGroup)) {
            return;
        }
        ViewGroup decorGroup = (ViewGroup) decor;
        if (navigationBarScrim == null) {
            navigationBarScrim = new View(this);
            navigationBarScrim.setClickable(false);
            navigationBarScrim.setFocusable(false);
            navigationBarScrim.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);
            navigationBarScrim.setElevation(64f);
            FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                navigationBarHeightPx(),
                Gravity.BOTTOM
            );
            decorGroup.addView(navigationBarScrim, lp);
            ViewCompat.setOnApplyWindowInsetsListener(navigationBarScrim, (v, insets) -> {
                layoutNavigationBarScrim(insets.getInsets(WindowInsetsCompat.Type.navigationBars()).bottom);
                return insets;
            });
        } else if (navigationBarScrim.getParent() == null) {
            FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                navigationBarHeightPx(),
                Gravity.BOTTOM
            );
            decorGroup.addView(navigationBarScrim, lp);
        }
        navigationBarScrim.setBackgroundColor(navColor);
        layoutNavigationBarScrim(navigationBarHeightPx());
        navigationBarScrim.bringToFront();
    }

    private int navigationBarHeightPx() {
        WindowInsetsCompat root = ViewCompat.getRootWindowInsets(getWindow().getDecorView());
        if (root != null) {
            int bottom = root.getInsets(WindowInsetsCompat.Type.navigationBars()).bottom;
            if (bottom > 0) {
                return bottom;
            }
        }
        int resId = getResources().getIdentifier("navigation_bar_height", "dimen", "android");
        if (resId > 0) {
            return getResources().getDimensionPixelSize(resId);
        }
        return Math.round(48f * getResources().getDisplayMetrics().density);
    }

    private void layoutNavigationBarScrim(int bottomPx) {
        if (navigationBarScrim == null) {
            return;
        }
        ViewGroup.LayoutParams lp = navigationBarScrim.getLayoutParams();
        int height = Math.max(0, bottomPx);
        if (lp == null) {
            return;
        }
        if (lp.height != height) {
            lp.height = height;
            navigationBarScrim.setLayoutParams(lp);
        }
        navigationBarScrim.bringToFront();
        navigationBarScrim.setVisibility(height > 0 ? View.VISIBLE : View.GONE);
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

        final String intentType = intent.getType();
        Log.i(TAG, "Share intent action=" + action + " type=" + intentType);

        ArrayList<Uri> uris = collectShareUris(intent, action);

        if (uris.isEmpty()) {
            Log.w(TAG, "Share intent: no stream URIs (extras keys="
                + (intent.getExtras() != null ? intent.getExtras().keySet() : "null") + ")");
            // Still open publish for non-image/pdf SEND so user is not dumped on Home.
            String typeLowerEmpty = intentType != null ? intentType.toLowerCase() : "";
            boolean likelyReceiptEmpty =
                typeLowerEmpty.startsWith("image/") || "application/pdf".equals(typeLowerEmpty);
            if (!likelyReceiptEmpty) {
                final String routeFallback = "/share/publish";
                ShareIntentStore.setPendingRoute(routeFallback);
                scheduleShareRouteUntilAck(routeFallback);
            }
            return;
        }

        String typeLower = intentType != null ? intentType.toLowerCase() : "";
        boolean likelyReceipt =
            typeLower.startsWith("image/") || "application/pdf".equals(typeLower);
        // Navigate immediately so user never lands on home while copy runs.
        final String route = likelyReceipt ? "/share/receipt-validation" : "/share/publish";
        ShareIntentStore.setPendingRoute(route);
        ShareIntentStore.setPendingError(null);
        Log.i(TAG, "Share intent: immediate route=" + route + " uriCount=" + uris.size());
        scheduleShareRouteUntilAck(route);

        // Open streams on the UI thread while the share grant is still valid, then copy off-thread.
        final ContentResolver cr = getContentResolver();
        final ArrayList<OpenedShareStream> opened = new ArrayList<>();
        for (int i = 0; i < uris.size() && opened.size() < 20; i++) {
            Uri uri = uris.get(i);
            try {
                InputStream in = cr.openInputStream(uri);
                if (in == null) {
                    Log.w(TAG, "openInputStream null on UI thread for " + uri);
                    continue;
                }
                String displayName = resolveDisplayName(uri, cr);
                String mime = null;
                try {
                    mime = cr.getType(uri);
                } catch (Exception ignored) {
                }
                opened.add(new OpenedShareStream(uri, in, displayName, mime));
                Log.i(TAG, "opened share stream on UI: " + displayName + " mime=" + mime);
            } catch (Exception e) {
                Log.e(TAG, "openInputStream failed on UI for " + uri, e);
            }
        }

        if (opened.isEmpty()) {
            Log.w(TAG, "Share intent: could not open any streams on UI thread");
            return;
        }

        new Thread(() -> {
            List<ShareIntentStore.PendingItem> items = new ArrayList<>();
            for (OpenedShareStream openedStream : opened) {
                try {
                    ShareIntentStore.PendingItem item =
                        copyOpenedStreamToCache(openedStream, intentType);
                    if (item != null) items.add(item);
                } catch (Exception e) {
                    Log.e(TAG, "copyOpenedStreamToCache failed for " + openedStream.uri, e);
                } finally {
                    try {
                        openedStream.inputStream.close();
                    } catch (Exception ignored) {
                    }
                }
            }
            if (items.isEmpty()) {
                Log.w(TAG, "Share intent: all URIs skipped after background copy");
                if (ShareIntentStore.peekPendingError() == null) {
                    ShareIntentStore.setPendingError("share.publish.errors.copyFailed");
                }
                runOnUiThread(() -> {
                    ShareIntentPlugin.notifyShareIntentReceived();
                    requestJsShareNavigation(route);
                });
                return;
            }
            Log.i(TAG, "Share intent: pending files=" + items.size()
                + " firstMime=" + items.get(0).mimeType
                + " firstName=" + items.get(0).name);
            ShareIntentStore.setPending(items);
            ShareIntentStore.setPendingRoute(route);
            runOnUiThread(() -> {
                ShareIntentPlugin.notifyShareIntentReceived();
                requestJsShareNavigation(route);
                getWindow().getDecorView().postDelayed(
                    () -> {
                        ShareIntentPlugin.notifyShareIntentReceived();
                        requestJsShareNavigation(route);
                    },
                    500
                );
            });
        }, "share-intent-copy").start();
    }

    private static final class OpenedShareStream {
        final Uri uri;
        final InputStream inputStream;
        final String displayName;
        final String resolverMime;

        OpenedShareStream(Uri uri, InputStream inputStream, String displayName, String resolverMime) {
            this.uri = uri;
            this.inputStream = inputStream;
            this.displayName = displayName;
            this.resolverMime = resolverMime;
        }
    }

    private ArrayList<Uri> collectShareUris(Intent intent, String action) {
        ArrayList<Uri> uris = new ArrayList<>();
        if (Intent.ACTION_SEND.equals(action)) {
            Uri stream = getSendStreamUri(intent);
            if (stream != null) uris.add(stream);
            try {
                @SuppressWarnings("deprecation")
                Uri legacy = intent.getParcelableExtra(Intent.EXTRA_STREAM);
                if (legacy != null && !uris.contains(legacy)) uris.add(legacy);
            } catch (Exception ignored) {
            }
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
            try {
                @SuppressWarnings("deprecation")
                ArrayList<Uri> legacyMulti = intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM);
                if (legacyMulti != null) {
                    for (Uri u : legacyMulti) {
                        if (u != null && !uris.contains(u)) uris.add(u);
                    }
                }
            } catch (Exception ignored) {
            }
        }
        return uris;
    }

    /**
     * Keep asking JS to navigate via React Router (custom event only — do NOT touch
     * history.replaceState; that desyncs BrowserRouter and leaves the user on Home).
     */
    private void scheduleShareRouteUntilAck(String path) {
        try {
            if (getBridge() != null && getBridge().getWebView() != null) {
                getBridge().getWebView().evaluateJavascript(
                    "window.__SYNCKERJA_SHARE_ROUTE_ACK__=undefined;",
                    null
                );
            }
        } catch (Exception ignored) {
        }
        requestJsShareNavigation(path);
        final long[] delaysMs = new long[] {300, 700, 1200, 2000, 3500, 5000, 8000, 12000, 16000};
        for (long delay : delaysMs) {
            getWindow().getDecorView().postDelayed(() -> requestJsShareNavigation(path), delay);
        }
    }

    /**
     * Signal React ({@code ShareIntentRouteSync}) — never mutate history directly.
     */
    private void requestJsShareNavigation(String path) {
        try {
            if (getBridge() == null || getBridge().getWebView() == null) {
                Log.w(TAG, "requestJsShareNavigation: bridge not ready for " + path);
                return;
            }
            String safe = path.replace("'", "");
            String js =
                "(function(){try{"
                    + "if(window.__SYNCKERJA_SHARE_ROUTE_ACK__==='" + safe + "')return;"
                    + "window.__SYNCKERJA_SHARE_ROUTE__='" + safe + "';"
                    + "window.dispatchEvent(new CustomEvent('synckerja-share-route',{detail:{path:'" + safe + "'}}));"
                    + "}catch(e){console.error('synckerja share nav',e);}})();";
            getBridge().getWebView().post(
                () -> getBridge().getWebView().evaluateJavascript(js, null)
            );
            Log.i(TAG, "requestJsShareNavigation: " + path);
        } catch (Exception e) {
            Log.e(TAG, "requestJsShareNavigation failed", e);
        }
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
        if (lower.endsWith(".mp4")) return ".mp4";
        if (lower.endsWith(".mov")) return ".mov";
        if (lower.endsWith(".webm")) return ".webm";
        if (lower.endsWith(".m4v")) return ".m4v";
        String m = mime != null ? mime.toLowerCase() : "";
        if ("application/pdf".equals(m)) return ".pdf";
        if ("image/png".equals(m)) return ".png";
        if ("image/webp".equals(m)) return ".webp";
        if ("image/gif".equals(m)) return ".gif";
        if ("video/mp4".equals(m)) return ".mp4";
        if ("video/quicktime".equals(m)) return ".mov";
        if ("video/webm".equals(m)) return ".webm";
        if (m.startsWith("video/")) return ".mp4";
        if (m.startsWith("image/")) return ".jpg";
        return ".mp4";
    }

    private ShareIntentStore.PendingItem copyOpenedStreamToCache(
        OpenedShareStream opened,
        String intentType
    ) throws IOException {
        String mime = opened.resolverMime;
        String intentTypeSafe = intentType != null ? intentType.trim() : "";
        String intentLower = intentTypeSafe.toLowerCase();

        if (mime == null
            || mime.isEmpty()
            || "application/octet-stream".equalsIgnoreCase(mime)
            || "*/*".equals(mime)) {
            if (!intentTypeSafe.isEmpty()
                && !"*/*".equals(intentLower)
                && !"application/octet-stream".equals(intentLower)) {
                mime = intentTypeSafe;
            } else if (mime == null || mime.isEmpty()) {
                mime = "application/octet-stream";
            }
        }

        String ml = mime.toLowerCase();
        String displayName = opened.displayName != null ? opened.displayName : "shared";
        String nameLower = displayName.toLowerCase();
        boolean videoByExt =
            nameLower.endsWith(".mp4")
                || nameLower.endsWith(".mov")
                || nameLower.endsWith(".webm")
                || nameLower.endsWith(".m4v")
                || nameLower.endsWith(".mkv")
                || nameLower.endsWith(".3gp");
        boolean intentSaysVideo = intentLower.startsWith("video/");
        boolean intentWildcard =
            intentLower.isEmpty()
                || "*/*".equals(intentLower)
                || "application/octet-stream".equals(intentLower);
        boolean isReceipt = ml.startsWith("image/") || "application/pdf".equals(ml);
        boolean isVideo = ml.startsWith("video/") || videoByExt || intentSaysVideo;

        if (!isVideo && !isReceipt && intentWildcard) {
            isVideo = true;
            mime = "video/mp4";
            ml = mime;
            Log.i(TAG, "Treating wildcard share as video: " + displayName);
        }

        if (!isVideo && !isReceipt) {
            Log.w(TAG, "skip mime: resolver=" + mime + " intent=" + intentType);
            return null;
        }

        if (isVideo && !ml.startsWith("video/")) {
            if (nameLower.endsWith(".mov")) mime = "video/quicktime";
            else if (nameLower.endsWith(".webm")) mime = "video/webm";
            else mime = "video/mp4";
            ml = mime;
        }

        if (isVideo && (displayName == null || "shared".equals(displayName) || !displayName.contains("."))) {
            displayName = "shared-video.mp4";
        }

        long maxBytes = isVideo ? MAX_SHARE_VIDEO_BYTES : MAX_SHARE_BYTES;

        String ext = extensionForMime(mime, displayName);
        File dir = new File(getCacheDir(), "incoming_share");
        if (!dir.exists() && !dir.mkdirs()) return null;
        String base = "share_" + System.currentTimeMillis() + "_" + (int) (Math.random() * 1_000_000_000);
        File outFile = new File(dir, base + ext);

        try (FileOutputStream out = new FileOutputStream(outFile)) {
            byte[] buf = new byte[8192];
            long total = 0;
            int read;
            while ((read = opened.inputStream.read(buf)) != -1) {
                total += read;
                if (total > maxBytes) {
                    out.close();
                    //noinspection ResultOfMethodCallIgnored
                    outFile.delete();
                    Log.w(TAG, "skip file larger than max bytes=" + total);
                    ShareIntentStore.setPendingError("share.publish.errors.videoTooLarge");
                    return null;
                }
                out.write(buf, 0, read);
            }
            Log.i(TAG, "copied share file bytes=" + total + " mime=" + mime + " name=" + displayName);
        }

        long fileLen = outFile.length();
        if (fileLen < 10 * 1024) {
            //noinspection ResultOfMethodCallIgnored
            outFile.delete();
            Log.w(TAG, "skip video too small bytes=" + fileLen);
            ShareIntentStore.setPendingError("share.publish.errors.invalidVideoFile");
            return null;
        }

        String lowerName = displayName.toLowerCase();
        if (!lowerName.endsWith(".mp4")
            && !lowerName.endsWith(".mov")
            && !lowerName.endsWith(".webm")
            && !lowerName.endsWith(".m4v")) {
            displayName = displayName + ext;
        }

        return new ShareIntentStore.PendingItem(
            outFile.getAbsolutePath(),
            displayName,
            mime,
            fileLen
        );
    }

    private ShareIntentStore.PendingItem copyUriToCache(
        Uri uri,
        ContentResolver cr,
        String intentType
    ) throws IOException {
        String mime = null;
        try {
            mime = cr.getType(uri);
        } catch (Exception e) {
            Log.w(TAG, "getType failed", e);
        }
        String displayName = resolveDisplayName(uri, cr);
        try (InputStream in = cr.openInputStream(uri)) {
            if (in == null) {
                Log.w(TAG, "openInputStream returned null for " + uri);
                return null;
            }
            return copyOpenedStreamToCache(
                new OpenedShareStream(uri, in, displayName, mime),
                intentType
            );
        }
    }
}
