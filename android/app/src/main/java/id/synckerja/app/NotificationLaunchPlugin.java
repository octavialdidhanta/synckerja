package id.synckerja.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "NotificationLaunch")
public class NotificationLaunchPlugin extends Plugin {

    @PluginMethod
    public void consumePendingPushTap(PluginCall call) {
        JSObject data = NotificationLaunchStore.consumePending();
        if (data == null) {
            call.resolve(new JSObject());
            return;
        }
        call.resolve(data);
    }
}
