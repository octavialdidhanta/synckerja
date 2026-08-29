package id.synckerja.pos;

import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ZoomDisable")
public class ZoomDisablePlugin extends Plugin {

    @Override
    public void load() {
        if (getActivity() == null) return;
        getActivity().runOnUiThread(this::applyNoZoom);
    }

    @PluginMethod
    public void ensureZoomDisabled(PluginCall call) {
        if (getActivity() == null) {
            call.resolve();
            return;
        }
        getActivity()
                .runOnUiThread(() -> {
                    applyNoZoom();
                    call.resolve();
                });
    }

    private void applyNoZoom() {
        WebView webView = getBridge().getWebView();
        if (webView == null) return;
        WebSettings settings = webView.getSettings();
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
    }
}
