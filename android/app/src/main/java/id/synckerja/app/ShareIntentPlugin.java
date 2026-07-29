package id.synckerja.app;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.RandomAccessFile;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.List;
import android.util.Base64;
import org.json.JSONObject;

@CapacitorPlugin(name = "ShareIntent")
public class ShareIntentPlugin extends Plugin {

    private static ShareIntentPlugin instance;

    @Override
    public void load() {
        instance = this;
        ShareIntentStore.init(getContext());
    }

    public static void notifyShareIntentReceived() {
        if (instance == null) return;
        JSObject payload = buildPayload();
        instance.notifyListeners("shareIntentReceived", payload);
    }

    private static JSObject buildPayload() {
        JSObject ret = new JSObject();
        JSArray arr = new JSArray();
        for (ShareIntentStore.PendingItem item : ShareIntentStore.snapshot()) {
            JSObject o = new JSObject();
            o.put("path", item.absolutePath);
            o.put("name", item.name);
            o.put("mimeType", item.mimeType != null ? item.mimeType : "");
            o.put("size", item.sizeBytes);
            arr.put(o);
        }
        ret.put("files", arr);
        String route = ShareIntentStore.peekPendingRoute();
        ret.put("route", route != null ? route : "");
        String error = ShareIntentStore.peekPendingError();
        ret.put("error", error != null ? error : "");
        return ret;
    }

    @PluginMethod
    public void getPendingPayload(PluginCall call) {
        call.resolve(buildPayload());
    }

    @PluginMethod
    public void getPendingRoute(PluginCall call) {
        JSObject ret = new JSObject();
        String route = ShareIntentStore.peekPendingRoute();
        ret.put("path", route != null ? route : "");
        call.resolve(ret);
    }

    @PluginMethod
    public void clearPendingRoute(PluginCall call) {
        ShareIntentStore.clearPendingRoute();
        call.resolve();
    }

    @PluginMethod
    public void clearPending(PluginCall call) {
        for (ShareIntentStore.PendingItem item : ShareIntentStore.snapshot()) {
            try {
                File f = new File(item.absolutePath);
                if (f.exists()) {
                    //noinspection ResultOfMethodCallIgnored
                    f.delete();
                }
            } catch (Exception ignored) {
            }
        }
        ShareIntentStore.clear();
        call.resolve();
    }

    /**
     * Read a byte range from a pending share cache file without loading the whole file into JS memory.
     * Used for Google Drive resumable upload chunks on large videos.
     */
    @PluginMethod
    public void readFileChunk(PluginCall call) {
        String path = call.getString("path");
        if (path == null || path.isEmpty()) {
            call.reject("path required");
            return;
        }

        long offset = parseCallLong(call, "offset", 0L);
        long length = parseCallLong(call, "length", 0L);
        if (length <= 0 || length > 8 * 1024 * 1024) {
            call.reject("invalid length");
            return;
        }
        if (offset < 0) {
            call.reject("invalid offset");
            return;
        }

        File file = new File(path);
        if (!file.exists() || !file.isFile()) {
            call.reject("file not found");
            return;
        }

        // Only allow reads from known pending share paths or app cache incoming_share.
        boolean allowed = false;
        for (ShareIntentStore.PendingItem item : ShareIntentStore.snapshot()) {
            if (item.absolutePath.equals(path)) {
                allowed = true;
                break;
            }
        }
        if (!allowed) {
            String cachePrefix = getContext().getCacheDir().getAbsolutePath() + File.separator + "incoming_share" + File.separator;
            if (!path.startsWith(cachePrefix)) {
                call.reject("path not allowed");
                return;
            }
        }

        try (RandomAccessFile raf = new RandomAccessFile(file, "r")) {
            long fileLen = raf.length();
            if (offset >= fileLen) {
                JSObject ret = new JSObject();
                ret.put("data", "");
                ret.put("bytesRead", 0);
                call.resolve(ret);
                return;
            }
            raf.seek(offset);
            int toRead = (int) Math.min(length, fileLen - offset);
            byte[] buf = new byte[toRead];
            int read = raf.read(buf);
            if (read <= 0) {
                JSObject ret = new JSObject();
                ret.put("data", "");
                ret.put("bytesRead", 0);
                call.resolve(ret);
                return;
            }
            String base64 = Base64.encodeToString(buf, 0, read, Base64.NO_WRAP);
            JSObject ret = new JSObject();
            ret.put("data", base64);
            ret.put("bytesRead", read);
            call.resolve(ret);
        } catch (IOException e) {
            call.reject("read failed", e);
        }
    }

    @PluginMethod
    public void getFileStat(PluginCall call) {
        String path = call.getString("path");
        if (path == null || path.isEmpty()) {
            call.reject("path required");
            return;
        }

        File file = new File(path);
        if (!file.exists() || !file.isFile()) {
            call.reject("file not found");
            return;
        }

        boolean allowed = false;
        for (ShareIntentStore.PendingItem item : ShareIntentStore.snapshot()) {
            if (item.absolutePath.equals(path)) {
                allowed = true;
                break;
            }
        }
        if (!allowed) {
            String cachePrefix =
                getContext().getCacheDir().getAbsolutePath()
                    + File.separator
                    + "incoming_share"
                    + File.separator;
            if (!path.startsWith(cachePrefix)) {
                call.reject("path not allowed");
                return;
            }
        }

        JSObject ret = new JSObject();
        ret.put("size", file.length());
        ret.put("name", file.getName());
        call.resolve(ret);
    }

  private boolean isAllowedShareCachePath(String path) {
    for (ShareIntentStore.PendingItem item : ShareIntentStore.snapshot()) {
      if (item.absolutePath.equals(path)) {
        return true;
      }
    }
    String cachePrefix =
        getContext().getCacheDir().getAbsolutePath()
            + File.separator
            + "incoming_share"
            + File.separator;
    return path.startsWith(cachePrefix);
  }

  private static String readStreamText(InputStream in, int maxChars) throws IOException {
    if (in == null) return "";
    byte[] buf = new byte[4096];
    StringBuilder sb = new StringBuilder();
    int read;
    while ((read = in.read(buf)) != -1 && sb.length() < maxChars) {
      sb.append(new String(buf, 0, read));
    }
    return sb.toString();
  }

  /** JS numbers arrive as Double; Capacitor getLong/getInt often miss them. */
  private static long parseCallLong(PluginCall call, String key, long defaultValue) {
    JSObject data = call.getData();
    if (data != null) {
      Object value = data.opt(key);
      if (value != null && value != JSONObject.NULL) {
        if (value instanceof Number) return ((Number) value).longValue();
        if (value instanceof String) {
          try {
            return Long.parseLong(((String) value).trim());
          } catch (NumberFormatException ignored) {
            return defaultValue;
          }
        }
      }
      double asDouble = data.optDouble(key, Double.NaN);
      if (!Double.isNaN(asDouble)) return (long) asDouble;
    }
    return defaultValue;
  }

  private static int parseCallInt(PluginCall call, String key, int defaultValue) {
    long parsed = parseCallLong(call, key, defaultValue);
    if (parsed > Integer.MAX_VALUE) return defaultValue;
    return (int) parsed;
  }

  private static boolean parseCallBoolean(PluginCall call, String key, boolean defaultValue) {
    JSObject data = call.getData();
    if (data != null) {
      Object value = data.opt(key);
      if (value != null && value != JSONObject.NULL) {
        if (value instanceof Boolean) return (Boolean) value;
        if (value instanceof Number) return ((Number) value).intValue() != 0;
        if (value instanceof String) {
          String s = ((String) value).trim();
          if ("true".equalsIgnoreCase(s) || "1".equals(s)) return true;
          if ("false".equalsIgnoreCase(s) || "0".equals(s)) return false;
        }
      }
      return data.optBoolean(key, defaultValue);
    }
    return defaultValue;
  }

  /**
   * PUT a byte range from the share cache file to Google Drive resumable upload URL.
   * Avoids passing multi-MB bodies through CapacitorHttp (which serializes File/Blob as 2 bytes).
   */
  @PluginMethod
  public void putDriveResumableChunk(PluginCall call) {
    String path = call.getString("path");
    String uploadUrl = call.getString("uploadUrl");
    if (path == null || path.isEmpty() || uploadUrl == null || uploadUrl.isEmpty()) {
      call.reject("path and uploadUrl required");
      return;
    }

    long offset = parseCallLong(call, "offset", 0L);
    long length = parseCallLong(call, "length", 0L);
    long total = parseCallLong(call, "total", 0L);
    boolean statusQuery = parseCallBoolean(call, "statusQuery", false);

    if (total <= 0) {
      call.reject("invalid total");
      return;
    }
    if (!statusQuery && (length <= 0 || length > 8 * 1024 * 1024)) {
      call.reject("invalid length");
      return;
    }
    if (offset < 0) {
      call.reject("invalid offset");
      return;
    }

    File file = new File(path);
    if (!file.exists() || !file.isFile()) {
      call.reject("file not found");
      return;
    }
    if (!isAllowedShareCachePath(path)) {
      call.reject("path not allowed");
      return;
    }

    new Thread(() -> {
      HttpURLConnection conn = null;
      try {
        URL url = new URL(uploadUrl);
        conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("PUT");
        conn.setDoOutput(true);
        conn.setConnectTimeout(60_000);
        conn.setReadTimeout(300_000);
        conn.setRequestProperty("Content-Type", "application/octet-stream");

        if (statusQuery) {
          conn.setRequestProperty("Content-Length", "0");
          conn.setRequestProperty("Content-Range", "bytes */" + total);
          conn.getOutputStream().close();
        } else {
          long end = offset + length - 1;
          conn.setRequestProperty("Content-Length", String.valueOf(length));
          conn.setRequestProperty("Content-Range", "bytes " + offset + "-" + end + "/" + total);

          try (OutputStream out = conn.getOutputStream();
              RandomAccessFile raf = new RandomAccessFile(file, "r")) {
            raf.seek(offset);
            byte[] buf = new byte[8192];
            long remaining = length;
            while (remaining > 0) {
              int toRead = (int) Math.min(buf.length, remaining);
              int read = raf.read(buf, 0, toRead);
              if (read <= 0) break;
              out.write(buf, 0, read);
              remaining -= read;
            }
          }
        }

        int statusCode = conn.getResponseCode();
        String rangeHeader = conn.getHeaderField("Range");
        if (rangeHeader == null) {
          rangeHeader = conn.getHeaderField("range");
        }
        String location = conn.getHeaderField("Location");
        if (location == null) {
          location = conn.getHeaderField("location");
        }

        String body;
        if (statusCode >= 400) {
          body = readStreamText(conn.getErrorStream(), 2048);
        } else {
          body = readStreamText(conn.getInputStream(), 2048);
        }

        JSObject ret = new JSObject();
        ret.put("statusCode", statusCode);
        ret.put("body", body != null ? body : "");
        if (rangeHeader != null) ret.put("range", rangeHeader);
        if (location != null) ret.put("location", location);
        call.resolve(ret);
      } catch (Exception e) {
        call.reject("put failed", e);
      } finally {
        if (conn != null) conn.disconnect();
      }
    }, "drive-resumable-chunk").start();
  }
}
