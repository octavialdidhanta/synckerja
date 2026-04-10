package id.synckerja.app;

import android.webkit.WebView;
import com.getcapacitor.Plugin;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "NoOverscroll")
public class NoOverscrollPlugin extends Plugin {

    @Override
    public void load() {
        WebView webView = getBridge().getWebView();
        if (webView != null) {
            webView.setOverScrollMode(WebView.OVER_SCROLL_NEVER);
        }
    }
}
