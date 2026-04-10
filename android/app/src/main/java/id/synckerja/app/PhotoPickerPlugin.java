package id.synckerja.app;

import android.content.ContentResolver;
import android.content.Context;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;
import android.util.Log;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.PickVisualMediaRequest;
import androidx.activity.result.contract.ActivityResultContracts;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;

/**
 * Android Photo Picker bridge — no READ_MEDIA_* permissions. URIs are copied to app cache for WebView.
 */
@CapacitorPlugin(name = "PhotoPicker")
public class PhotoPickerPlugin extends Plugin {

    private static final String TAG = "PhotoPickerPlugin";
    private static final int PICKER_MAX_ITEMS = 20;
    private static final long MAX_FILE_BYTES = 10L * 1024 * 1024;

    private static ActivityResultLauncher<PickVisualMediaRequest> photoPickLauncher;
    private static PluginCall pendingCall;

    public static void setPhotoPickLauncher(ActivityResultLauncher<PickVisualMediaRequest> launcher) {
        photoPickLauncher = launcher;
    }

    public static void deliverPickerResult(Context context, List<Uri> uris) {
        PluginCall call = pendingCall;
        pendingCall = null;
        if (call == null) {
            Log.w(TAG, "deliverPickerResult: no pending call");
            return;
        }
        if (context == null) {
            call.reject("No context");
            return;
        }

        int maxItems = call.getInt("maxItems", 10);
        if (maxItems < 1) maxItems = 1;
        if (maxItems > PICKER_MAX_ITEMS) maxItems = PICKER_MAX_ITEMS;

        JSObject ret = new JSObject();
        JSArray arr = new JSArray();
        if (uris != null && !uris.isEmpty()) {
            ContentResolver cr = context.getContentResolver();
            int n = 0;
            for (Uri uri : uris) {
                if (n >= maxItems) break;
                if (uri == null) continue;
                try {
                    ShareIntentStore.PendingItem item = copyUriToCache(context, uri, cr);
                    if (item != null) {
                        JSObject o = new JSObject();
                        o.put("path", item.absolutePath);
                        o.put("name", item.name);
                        o.put("mimeType", item.mimeType != null ? item.mimeType : "");
                        arr.put(o);
                        n++;
                    }
                } catch (IOException e) {
                    Log.e(TAG, "copyUriToCache", e);
                }
            }
        }
        ret.put("files", arr);
        call.resolve(ret);
    }

    @PluginMethod
    public void pickMedia(PluginCall call) {
        if (photoPickLauncher == null) {
            call.reject("Photo picker is not initialized");
            return;
        }
        if (pendingCall != null) {
            PluginCall prev = pendingCall;
            pendingCall = null;
            prev.reject("Replaced by a new picker request");
        }
        pendingCall = call;

        boolean imageAndVideo = "imageAndVideo".equals(call.getString("mediaType"));
        PickVisualMediaRequest.Builder builder = new PickVisualMediaRequest.Builder();
        if (imageAndVideo) {
            builder.setMediaType(ActivityResultContracts.PickVisualMedia.ImageAndVideo.INSTANCE);
        } else {
            builder.setMediaType(ActivityResultContracts.PickVisualMedia.ImageOnly.INSTANCE);
        }
        try {
            photoPickLauncher.launch(builder.build());
        } catch (Exception e) {
            pendingCall = null;
            call.reject("Failed to open photo picker", e);
        }
    }

    private static String resolveDisplayName(Uri uri, ContentResolver cr) {
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
        return "picked";
    }

    private static String extensionForMime(String mime, String displayName) {
        String lower = displayName.toLowerCase();
        if (lower.endsWith(".png")) return ".png";
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return ".jpg";
        if (lower.endsWith(".webp")) return ".webp";
        if (lower.endsWith(".gif")) return ".gif";
        if (lower.endsWith(".mp4")) return ".mp4";
        if (lower.endsWith(".webm")) return ".webm";
        String m = mime != null ? mime.toLowerCase() : "";
        if ("image/png".equals(m)) return ".png";
        if ("image/webp".equals(m)) return ".webp";
        if ("image/gif".equals(m)) return ".gif";
        if ("video/mp4".equals(m)) return ".mp4";
        return ".jpg";
    }

    private static ShareIntentStore.PendingItem copyUriToCache(Context context, Uri uri, ContentResolver cr)
            throws IOException {
        String mime = cr.getType(uri);
        if (mime == null) mime = "application/octet-stream";
        String ml = mime.toLowerCase();
        if (!ml.startsWith("image/") && !ml.startsWith("video/")) {
            Log.w(TAG, "skip mime: " + mime);
            return null;
        }

        String displayName = resolveDisplayName(uri, cr);
        String ext = extensionForMime(mime, displayName);
        File dir = new File(context.getCacheDir(), "photo_picker");
        if (!dir.exists() && !dir.mkdirs()) return null;
        String base = "pick_" + System.currentTimeMillis() + "_" + (int) (Math.random() * 1_000_000_000);
        File outFile = new File(dir, base + ext);

        try (InputStream in = cr.openInputStream(uri); FileOutputStream out = new FileOutputStream(outFile)) {
            if (in == null) return null;
            byte[] buf = new byte[8192];
            long total = 0;
            int read;
            while ((read = in.read(buf)) != -1) {
                total += read;
                if (total > MAX_FILE_BYTES) {
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
