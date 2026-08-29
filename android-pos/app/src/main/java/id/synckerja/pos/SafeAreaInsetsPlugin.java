package id.synckerja.pos;

import android.app.Activity;
import android.view.View;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "SafeAreaInsets")
public class SafeAreaInsetsPlugin extends Plugin {

    /**
     * Batas atas (dp → angka untuk CSS px). Mencegah laporan WindowInsets abnormal yang membesar;
     * jangan terlalu kecil agar notch / status bar tetap aman.
     */
    private static final int MAX_TOP_INSET_DP = 52;

    /** Di bawah nilai ini, anggap inset belum siap / terkonsumsi — pakai fallback resource sistem. */
    private static final int TOP_INSET_TRUST_MIN_DP = 12;

    @PluginMethod
    public void getInsets(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            resolveZero(call);
            return;
        }
        activity.runOnUiThread(() -> getInsetsOnUiThread(call, activity));
    }

    private void getInsetsOnUiThread(PluginCall call, Activity activity) {
        try {
            /**
             * Selalu {@code decorView}: inset pada {@link android.webkit.WebView} sering **0** setelah
             * konsumsi inset internal — variabel CSS jadi 0 → logo/header tertutup status bar.
             */
            View decor = activity.getWindow().getDecorView();
            WindowInsetsCompat insets = ViewCompat.getRootWindowInsets(decor);

            if (insets != null) {
                resolveWithInsets(call, insets, activity);
            } else {
                decor.post(
                        () -> {
                            WindowInsetsCompat retry = ViewCompat.getRootWindowInsets(decor);
                            if (retry != null) {
                                resolveWithInsets(call, retry, activity);
                                return;
                            }
                            decor.postDelayed(
                                    () -> {
                                        WindowInsetsCompat retry2 = ViewCompat.getRootWindowInsets(decor);
                                        if (retry2 != null) {
                                            resolveWithInsets(call, retry2, activity);
                                        } else {
                                            resolveWithFallbackTop(call, activity);
                                        }
                                    },
                                    150);
                        });
            }
        } catch (Exception e) {
            call.reject("Failed to get safe area insets", e);
        }
    }

    private void resolveZero(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("top", 0);
        ret.put("bottom", 0);
        call.resolve(ret);
    }

    /** Tinggi status bar standar (dp) dari resource framework — cadangan bila WindowInsets top ≈ 0. */
    private static int statusBarFallbackDp(Activity activity) {
        int resId = activity.getResources().getIdentifier("status_bar_height", "dimen", "android");
        if (resId > 0) {
            int px = activity.getResources().getDimensionPixelSize(resId);
            float d = activity.getResources().getDisplayMetrics().density;
            if (d <= 0f) {
                d = 1f;
            }
            return Math.max(12, Math.round(px / d));
        }
        return 28;
    }

    private void resolveWithFallbackTop(PluginCall call, Activity activity) {
        JSObject ret = new JSObject();
        ret.put("top", statusBarFallbackDp(activity));
        ret.put("bottom", 0);
        call.resolve(ret);
    }

    private void resolveWithInsets(PluginCall call, WindowInsetsCompat insets, Activity activity) {
        float density = activity.getResources().getDisplayMetrics().density;
        if (density <= 0f) {
            density = 1f;
        }
        int topPx = insets.getInsets(WindowInsetsCompat.Type.statusBars()).top;
        int bottomPx = insets.getInsets(WindowInsetsCompat.Type.navigationBars()).bottom;
        int top = Math.round(topPx / density);
        if (top < TOP_INSET_TRUST_MIN_DP) {
            top = Math.max(top, statusBarFallbackDp(activity));
        }
        top = Math.min(top, MAX_TOP_INSET_DP);
        int bottom = Math.round(bottomPx / density);
        JSObject ret = new JSObject();
        ret.put("top", Math.max(0, top));
        ret.put("bottom", Math.max(0, bottom));
        call.resolve(ret);
    }
}
