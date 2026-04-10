package id.synckerja.app;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.util.List;

@CapacitorPlugin(name = "ShareIntent")
public class ShareIntentPlugin extends Plugin {

    private static ShareIntentPlugin instance;

    @Override
    public void load() {
        instance = this;
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
            arr.put(o);
        }
        ret.put("files", arr);
        return ret;
    }

    @PluginMethod
    public void getPendingPayload(PluginCall call) {
        call.resolve(buildPayload());
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
}
