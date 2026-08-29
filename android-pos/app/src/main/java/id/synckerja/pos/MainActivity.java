package id.synckerja.pos;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.widget.FrameLayout;
import androidx.core.content.ContextCompat;
import androidx.core.splashscreen.SplashScreen;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginHandle;
import ee.forgr.capacitor.social.login.GoogleProvider;
import ee.forgr.capacitor.social.login.ModifiedMainActivityForSocialLoginPlugin;
import ee.forgr.capacitor.social.login.SocialLoginPlugin;

/**
 * Synckerja POS native shell ({@code id.synckerja.pos}).
 * Slim vs Office: WebView helpers + Bluetooth printer; no share/photo-picker flows.
 */
public class MainActivity extends BridgeActivity implements ModifiedMainActivityForSocialLoginPlugin {

    public static final String NOTIFICATIONS_CHANNEL_ID = "notifications";

    private View navigationBarScrim;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        SplashScreen.installSplashScreen(this);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        applyLightStatusBarAppearance();

        registerPlugin(ZoomDisablePlugin.class);
        registerPlugin(SafeAreaInsetsPlugin.class);
        registerPlugin(NoOverscrollPlugin.class);
        registerPlugin(WebViewMediaPlugin.class);
        registerPlugin(PosBluetoothPrinterPlugin.class);
        registerPlugin(FirebaseReadyPlugin.class);

        applyBlackSystemNavigationBar();
        super.onCreate(savedInstanceState);
        applyBlackSystemNavigationBar();
        scheduleSystemBarReapply();
        AppNotificationChannels.ensureAppNotificationsChannel(this);
    }

    @Override
    public void onActivityResult(int requestCode, int resultCode, android.content.Intent data) {
        if (requestCode >= GoogleProvider.REQUEST_AUTHORIZE_GOOGLE_MIN
            && requestCode < GoogleProvider.REQUEST_AUTHORIZE_GOOGLE_MAX) {
            PluginHandle pluginHandle = getBridge().getPlugin("SocialLogin");
            if (pluginHandle != null) {
                Plugin plugin = pluginHandle.getInstance();
                if (plugin instanceof SocialLoginPlugin) {
                    ((SocialLoginPlugin) plugin).handleGoogleLoginIntent(requestCode, data);
                }
            }
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    public void IHaveModifiedTheMainActivityForTheUseWithSocialLoginPlugin() {
        // Capgo Social Login marker
    }

    @Override
    public void onResume() {
        super.onResume();
        applyBlackSystemNavigationBar();
        scheduleSystemBarReapply();
    }

    private void scheduleSystemBarReapply() {
        View decor = getWindow().getDecorView();
        decor.post(this::applyBlackSystemNavigationBar);
        decor.postDelayed(this::applyBlackSystemNavigationBar, 100);
        decor.postDelayed(this::applyBlackSystemNavigationBar, 400);
        decor.postDelayed(this::applyBlackSystemNavigationBar, 900);
    }

    @SuppressWarnings("deprecation")
    private void setStatusBarColorCompat(int color) {
        getWindow().setStatusBarColor(color);
    }

    private void applyLightStatusBarAppearance() {
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        setStatusBarColorCompat(Color.WHITE);
        WindowInsetsControllerCompat controller =
            WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        if (controller != null) {
            controller.setAppearanceLightStatusBars(true);
        }
    }

    @SuppressWarnings("deprecation")
    private void setNavigationBarColorCompat(int color) {
        getWindow().setNavigationBarColor(color);
    }

    @SuppressWarnings("deprecation")
    private void applyBlackSystemNavigationBar() {
        getWindow().clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
        getWindow().clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_NAVIGATION);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        int navColor = ContextCompat.getColor(this, R.color.system_navigation_bar_background);
        setNavigationBarColorCompat(navColor);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            getWindow().setNavigationBarContrastEnforced(false);
        }
        View decor = getWindow().getDecorView();
        int vis = decor.getSystemUiVisibility();
        vis &= ~(View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_IMMERSIVE
            | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            | View.SYSTEM_UI_FLAG_FULLSCREEN
            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
        decor.setSystemUiVisibility(vis);

        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(getWindow(), decor);
        if (controller != null) {
            controller.show(WindowInsetsCompat.Type.navigationBars());
            controller.setAppearanceLightNavigationBars(false);
        }
        ensureNavigationBarScrim(navColor);
        ViewCompat.requestApplyInsets(decor);
    }

    private void ensureNavigationBarScrim(int navColor) {
        View decor = getWindow().getDecorView();
        if (!(decor instanceof ViewGroup)) {
            return;
        }
        ViewGroup decorGroup = (ViewGroup) decor;
        if (navigationBarScrim == null) {
            navigationBarScrim = new View(this);
            navigationBarScrim.setClickable(false);
            navigationBarScrim.setFocusable(false);
            navigationBarScrim.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);
            navigationBarScrim.setElevation(64f);
            FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                navigationBarHeightPx(),
                Gravity.BOTTOM
            );
            decorGroup.addView(navigationBarScrim, lp);
            ViewCompat.setOnApplyWindowInsetsListener(navigationBarScrim, (v, insets) -> {
                layoutNavigationBarScrim(insets.getInsets(WindowInsetsCompat.Type.navigationBars()).bottom);
                return insets;
            });
        } else if (navigationBarScrim.getParent() == null) {
            FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                navigationBarHeightPx(),
                Gravity.BOTTOM
            );
            decorGroup.addView(navigationBarScrim, lp);
        }
        navigationBarScrim.setBackgroundColor(navColor);
        layoutNavigationBarScrim(navigationBarHeightPx());
        navigationBarScrim.bringToFront();
    }

    private int navigationBarHeightPx() {
        WindowInsetsCompat root = ViewCompat.getRootWindowInsets(getWindow().getDecorView());
        if (root != null) {
            int bottom = root.getInsets(WindowInsetsCompat.Type.navigationBars()).bottom;
            if (bottom > 0) {
                return bottom;
            }
        }
        int resId = getResources().getIdentifier("navigation_bar_height", "dimen", "android");
        if (resId > 0) {
            return getResources().getDimensionPixelSize(resId);
        }
        return Math.round(48f * getResources().getDisplayMetrics().density);
    }

    private void layoutNavigationBarScrim(int bottomPx) {
        if (navigationBarScrim == null) {
            return;
        }
        ViewGroup.LayoutParams lp = navigationBarScrim.getLayoutParams();
        int height = Math.max(0, bottomPx);
        if (lp == null) {
            return;
        }
        if (lp.height != height) {
            lp.height = height;
            navigationBarScrim.setLayoutParams(lp);
        }
        navigationBarScrim.bringToFront();
        navigationBarScrim.setVisibility(height > 0 ? View.VISIBLE : View.GONE);
    }
}
