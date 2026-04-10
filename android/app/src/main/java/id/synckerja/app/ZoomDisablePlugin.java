package id.synckerja.app;

import android.webkit.WebView;
import com.getcapacitor.Plugin;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ZoomDisable")
public class ZoomDisablePlugin extends Plugin {

    @Override
    public void load() {
        WebView webView = getBridge().getWebView();
        if (webView != null) {
            webView.getSettings().setSupportZoom(false);
            webView.getSettings().setBuiltInZoomControls(false);
        }
    }
}
