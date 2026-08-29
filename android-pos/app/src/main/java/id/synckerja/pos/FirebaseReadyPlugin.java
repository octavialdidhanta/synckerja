package id.synckerja.pos;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.firebase.FirebaseApp;

/** Lets JS skip FCM register when google-services.json did not initialize FirebaseApp. */
@CapacitorPlugin(name = "FirebaseReady")
public class FirebaseReadyPlugin extends Plugin {

    @PluginMethod
    public void isReady(PluginCall call) {
        boolean ready = false;
        try {
            ready = !FirebaseApp.getApps(getContext()).isEmpty();
        } catch (Exception ignored) {
            ready = false;
        }
        JSObject ret = new JSObject();
        ret.put("ready", ready);
        call.resolve(ret);
    }
}
