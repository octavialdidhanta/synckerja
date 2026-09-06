package id.synckerja.pos;

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
            // Avoid WebView jumping to a focused node before adjustResize settles.
            webView.getSettings().setNeedInitialFocus(false);
        }
    }
}
