package id.synckerja.app;

import android.os.Build;
import android.webkit.CookieManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.Plugin;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * TikTok/YouTube iframes show "Server error" in Android WebView unless third-party
 * cookies are allowed, media autoplay is permitted, and the WebView {@code wv}
 * user-agent marker is removed.
 */
@CapacitorPlugin(name = "WebViewMedia")
public class WebViewMediaPlugin extends Plugin {

    @Override
    public void load() {
        apply();
        WebView webView = getBridge().getWebView();
        if (webView != null) {
            webView.post(this::apply);
        }
    }

    private void apply() {
        WebView webView = getBridge().getWebView();
        if (webView == null) return;

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);
        settings.setMediaPlaybackRequiresUserGesture(false);

        String ua = settings.getUserAgentString();
        if (ua != null && ua.contains("; wv)")) {
            settings.setUserAgentString(ua.replace("; wv)", ")"));
        }

        CookieManager cookies = CookieManager.getInstance();
        cookies.setAcceptCookie(true);
        cookies.setAcceptThirdPartyCookies(webView, true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            cookies.flush();
        }
    }
}
