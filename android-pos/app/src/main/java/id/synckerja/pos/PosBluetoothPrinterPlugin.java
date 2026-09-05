package id.synckerja.pos;

import android.Manifest;
import android.annotation.SuppressLint;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothSocket;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;
import android.util.Log;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.IOException;
import java.io.OutputStream;
import java.lang.reflect.Method;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Classic Bluetooth SPP bridge for thermal POS printers (e.g. RPP02N).
 *
 * Connect strategy (common for cheap ESC/POS printers):
 * 1) insecure RFCOMM SPP UUID
 * 2) secure RFCOMM SPP UUID
 * 3) reflection createRfcommSocket(1)
 * with a hard timeout so connect() cannot hang forever.
 *
 * Android 12+ (API 31): BLUETOOTH_CONNECT / BLUETOOTH_SCAN are runtime permissions.
 * Calling {@link BluetoothAdapter#isEnabled()} or {@link BluetoothAdapter#getBondedDevices()}
 * without CONNECT throws SecurityException and can kill the WebView — guard every entry.
 */
@CapacitorPlugin(
    name = "PosBluetoothPrinter",
    permissions = {
        @Permission(
            alias = "bluetooth",
            strings = {
                Manifest.permission.BLUETOOTH_CONNECT,
                Manifest.permission.BLUETOOTH_SCAN
            }
        ),
        @Permission(
            alias = "bluetoothLegacy",
            strings = { Manifest.permission.ACCESS_FINE_LOCATION }
        )
    }
)
public class PosBluetoothPrinterPlugin extends Plugin {

    private static final String TAG = "PosBluetoothPrinter";
    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");
    private static final long CONNECT_TIMEOUT_MS = 12_000L;

    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private final Handler main = new Handler(Looper.getMainLooper());
    private final AtomicReference<BluetoothSocket> socketRef = new AtomicReference<>();
    /** Socket currently in connect(); closed on timeout so RFCOMM does not hang forever. */
    private final AtomicReference<BluetoothSocket> connectingRef = new AtomicReference<>();
    private BroadcastReceiver discoveryReceiver;

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("available", getAdapter() != null);
        call.resolve(ret);
    }

    @PluginMethod
    public void getAdapterState(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("enabled", isAdapterEnabledSafe());
        call.resolve(ret);
    }

    @PluginMethod
    public void requestEnable(PluginCall call) {
        BluetoothAdapter adapter = getAdapter();
        if (adapter == null) {
            call.reject("Bluetooth not supported");
            return;
        }
        if (isAdapterEnabledSafe()) {
            JSObject ret = new JSObject();
            ret.put("enabled", true);
            call.resolve(ret);
            return;
        }
        try {
            Intent intent = new Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE);
            // Prefer activity context — NEW_TASK from Application can crash on some OEMs.
            Context ctx = getActivity() != null ? getActivity() : getContext();
            if (getActivity() == null) {
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            }
            ctx.startActivity(intent);
        } catch (Exception e) {
            Log.w(TAG, "requestEnable startActivity", e);
        }
        JSObject ret = new JSObject();
        ret.put("enabled", isAdapterEnabledSafe());
        call.resolve(ret);
    }

    @SuppressLint("MissingPermission")
    @PluginMethod
    public void listBondedDevices(PluginCall call) {
        if (!ensureBluetoothPermission(call, "listBondedDevices")) return;
        try {
            BluetoothAdapter adapter = getAdapter();
            if (adapter == null) {
                call.reject("Bluetooth not supported");
                return;
            }
            JSArray arr = new JSArray();
            Set<BluetoothDevice> bonded = adapter.getBondedDevices();
            if (bonded != null) {
                for (BluetoothDevice device : bonded) {
                    arr.put(deviceToJson(device, true));
                }
            }
            JSObject ret = new JSObject();
            ret.put("devices", arr);
            call.resolve(ret);
        } catch (SecurityException e) {
            Log.e(TAG, "listBondedDevices permission", e);
            call.reject("Bluetooth permission denied");
        } catch (Exception e) {
            Log.e(TAG, "listBondedDevices failed", e);
            call.reject(e.getMessage() != null ? e.getMessage() : "listBondedDevices failed");
        }
    }

    @SuppressLint("MissingPermission")
    @PluginMethod
    public void startDiscovery(PluginCall call) {
        if (!ensureBluetoothPermission(call, "startDiscovery")) return;
        try {
            BluetoothAdapter adapter = getAdapter();
            if (adapter == null) {
                call.reject("Bluetooth not supported");
                return;
            }
            if (!isAdapterEnabledSafe()) {
                call.reject("Bluetooth is off");
                return;
            }
            stopDiscoveryInternal();
            discoveryReceiver = new BroadcastReceiver() {
                @Override
                public void onReceive(Context context, Intent intent) {
                    try {
                        String action = intent != null ? intent.getAction() : null;
                        if (BluetoothDevice.ACTION_FOUND.equals(action)) {
                            BluetoothDevice device = readBluetoothDeviceExtra(intent);
                            if (device == null) return;
                            boolean bonded = false;
                            try {
                                bonded = device.getBondState() == BluetoothDevice.BOND_BONDED;
                            } catch (SecurityException ignored) {
                            }
                            notifyListeners("deviceFound", deviceToJson(device, bonded));
                        } else if (BluetoothAdapter.ACTION_DISCOVERY_FINISHED.equals(action)) {
                            notifyListeners("discoveryFinished", new JSObject());
                        }
                    } catch (Exception e) {
                        Log.w(TAG, "discovery onReceive", e);
                    }
                }
            };
            IntentFilter filter = new IntentFilter();
            filter.addAction(BluetoothDevice.ACTION_FOUND);
            filter.addAction(BluetoothAdapter.ACTION_DISCOVERY_FINISHED);
            Context ctx = getActivity() != null ? getActivity() : getContext();
            // System Bluetooth broadcasts require an exported receiver on API 33+.
            ContextCompat.registerReceiver(
                ctx,
                discoveryReceiver,
                filter,
                ContextCompat.RECEIVER_EXPORTED
            );
            // Emit bonded devices immediately so UI has something to pick
            try {
                Set<BluetoothDevice> bonded = adapter.getBondedDevices();
                if (bonded != null) {
                    for (BluetoothDevice device : bonded) {
                        notifyListeners("deviceFound", deviceToJson(device, true));
                    }
                }
            } catch (SecurityException e) {
                Log.w(TAG, "bonded emit during discovery", e);
            }
            boolean started = adapter.startDiscovery();
            if (!started) {
                Log.w(TAG, "startDiscovery returned false");
            }
            call.resolve();
        } catch (SecurityException e) {
            Log.e(TAG, "startDiscovery permission", e);
            stopDiscoveryInternal();
            call.reject("Bluetooth permission denied");
        } catch (Exception e) {
            Log.e(TAG, "startDiscovery failed", e);
            stopDiscoveryInternal();
            call.reject(e.getMessage() != null ? e.getMessage() : "startDiscovery failed");
        }
    }

    @SuppressLint("MissingPermission")
    @PluginMethod
    public void stopDiscovery(PluginCall call) {
        try {
            stopDiscoveryInternal();
            call.resolve();
        } catch (Exception e) {
            Log.w(TAG, "stopDiscovery", e);
            call.resolve();
        }
    }

    @PluginMethod
    public void connect(PluginCall call) {
        if (!ensureBluetoothPermission(call, "connect")) return;
        String address = call.getString("address");
        if (address == null || address.isEmpty()) {
            call.reject("address required");
            return;
        }
        // Discovery holds the radio; stop fully before RFCOMM.
        stopDiscoveryInternal();
        io.execute(() -> {
            try {
                connectWithTimeout(address, CONNECT_TIMEOUT_MS);
                main.post(call::resolve);
            } catch (TimeoutException e) {
                Log.e(TAG, "connect timeout", e);
                closeSocket();
                main.post(() -> call.reject("Connect timed out. Is the printer on and paired?"));
            } catch (SecurityException e) {
                Log.e(TAG, "connect permission", e);
                closeSocket();
                main.post(() -> call.reject("Bluetooth permission denied"));
            } catch (Exception e) {
                Log.e(TAG, "connect failed", e);
                closeSocket();
                String msg = e.getMessage() != null ? e.getMessage() : "connect failed";
                main.post(() -> call.reject(msg));
            }
        });
    }

    @PluginMethod
    public void disconnect(PluginCall call) {
        io.execute(() -> {
            closeSocket();
            main.post(call::resolve);
        });
    }

    @PluginMethod
    public void printRaw(PluginCall call) {
        if (!ensureBluetoothPermission(call, "printRaw")) return;
        String dataBase64 = call.getString("dataBase64");
        if (dataBase64 == null || dataBase64.isEmpty()) {
            call.reject("dataBase64 required");
            return;
        }
        io.execute(() -> {
            try {
                byte[] data = Base64.decode(dataBase64, Base64.DEFAULT);
                BluetoothSocket s = socketRef.get();
                if (s == null || !s.isConnected()) {
                    throw new IOException("Not connected");
                }
                OutputStream out = s.getOutputStream();
                out.write(data);
                out.flush();
                main.post(call::resolve);
            } catch (Exception e) {
                Log.e(TAG, "printRaw failed", e);
                main.post(() -> call.reject(e.getMessage() != null ? e.getMessage() : "print failed"));
            }
        });
    }

    @PermissionCallback
    private void bluetoothPermsCallback(PluginCall call) {
        if (hasRequiredBluetoothPermission(call.getMethodName())) {
            String method = call.getMethodName();
            if ("listBondedDevices".equals(method)) listBondedDevices(call);
            else if ("startDiscovery".equals(method)) startDiscovery(call);
            else if ("connect".equals(method)) connect(call);
            else if ("printRaw".equals(method)) printRaw(call);
            else call.resolve();
        } else {
            call.reject("Bluetooth permission denied");
        }
    }

    private boolean ensureBluetoothPermission(PluginCall call, String methodName) {
        if (hasRequiredBluetoothPermission(methodName)) {
            return true;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            requestPermissionForAlias("bluetooth", call, "bluetoothPermsCallback");
        } else if ("startDiscovery".equals(methodName)) {
            requestPermissionForAlias("bluetoothLegacy", call, "bluetoothPermsCallback");
        } else {
            return true;
        }
        return false;
    }

    private boolean hasRequiredBluetoothPermission(String methodName) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            return ActivityCompat.checkSelfPermission(getContext(), Manifest.permission.BLUETOOTH_CONNECT)
                    == PackageManager.PERMISSION_GRANTED
                && ActivityCompat.checkSelfPermission(getContext(), Manifest.permission.BLUETOOTH_SCAN)
                    == PackageManager.PERMISSION_GRANTED;
        }
        if ("startDiscovery".equals(methodName)) {
            return ActivityCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_FINE_LOCATION)
                == PackageManager.PERMISSION_GRANTED;
        }
        return true;
    }

    /** Never throw — Android 12+ requires CONNECT for isEnabled(). */
    @SuppressLint("MissingPermission")
    private boolean isAdapterEnabledSafe() {
        BluetoothAdapter adapter = getAdapter();
        if (adapter == null) return false;
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                if (ActivityCompat.checkSelfPermission(getContext(), Manifest.permission.BLUETOOTH_CONNECT)
                        != PackageManager.PERMISSION_GRANTED) {
                    // Without CONNECT we cannot read state; assume off so UI asks for permission next.
                    return false;
                }
            }
            return adapter.isEnabled();
        } catch (SecurityException e) {
            Log.w(TAG, "isEnabled SecurityException", e);
            return false;
        }
    }

    private BluetoothAdapter getAdapter() {
        try {
            BluetoothManager mgr = (BluetoothManager) getContext().getSystemService(Context.BLUETOOTH_SERVICE);
            return mgr != null ? mgr.getAdapter() : null;
        } catch (Exception e) {
            Log.w(TAG, "getAdapter", e);
            return null;
        }
    }

    private static BluetoothDevice readBluetoothDeviceExtra(Intent intent) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            return intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE, BluetoothDevice.class);
        }
        return readBluetoothDeviceExtraLegacy(intent);
    }

    @SuppressWarnings("deprecation")
    private static BluetoothDevice readBluetoothDeviceExtraLegacy(Intent intent) {
        return intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE);
    }

    /**
     * Run connect on a dedicated thread so we can close the socket after timeout
     * (BluetoothSocket.connect blocks and does not honor Thread.interrupt reliably).
     */
    private void connectWithTimeout(String address, long timeoutMs) throws Exception {
        ExecutorService connectExec = Executors.newSingleThreadExecutor();
        Future<BluetoothSocket> future = connectExec.submit(() -> openSocket(address));
        try {
            BluetoothSocket opened = future.get(timeoutMs, TimeUnit.MILLISECONDS);
            socketRef.set(opened);
        } catch (TimeoutException e) {
            future.cancel(true);
            safeClose(connectingRef.getAndSet(null));
            closeSocket();
            throw e;
        } catch (Exception e) {
            safeClose(connectingRef.getAndSet(null));
            closeSocket();
            Throwable cause = e.getCause() != null ? e.getCause() : e;
            if (cause instanceof Exception) throw (Exception) cause;
            throw new IOException(cause.getMessage() != null ? cause.getMessage() : "connect failed", cause);
        } finally {
            connectExec.shutdownNow();
        }
    }

    @SuppressLint("MissingPermission")
    private BluetoothSocket openSocket(String address) throws IOException {
        closeSocket();
        BluetoothAdapter adapter = getAdapter();
        if (adapter == null) throw new IOException("Bluetooth not supported");
        try {
            if (!adapter.isEnabled()) throw new IOException("Bluetooth is off");
            if (adapter.isDiscovering()) adapter.cancelDiscovery();
        } catch (SecurityException e) {
            throw new IOException("Bluetooth permission denied", e);
        }

        BluetoothDevice device;
        try {
            device = adapter.getRemoteDevice(address.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new IOException("Invalid printer address");
        }

        IOException last = null;

        // 1) Insecure SPP — works for most cheap ESC/POS printers
        last = tryConnect(device.createInsecureRfcommSocketToServiceRecord(SPP_UUID), "insecure SPP");
        if (last == null) return takeConnectingSocket();

        // 2) Secure SPP
        last = tryConnect(device.createRfcommSocketToServiceRecord(SPP_UUID), "secure SPP");
        if (last == null) return takeConnectingSocket();

        // 3) Reflection channel 1 (legacy printers)
        try {
            Method m = device.getClass().getMethod("createRfcommSocket", int.class);
            BluetoothSocket s = (BluetoothSocket) m.invoke(device, 1);
            if (s == null) throw new IOException("createRfcommSocket returned null");
            last = tryConnect(s, "reflection RFCOMM");
            if (last == null) return takeConnectingSocket();
        } catch (Exception e) {
            Log.w(TAG, "reflection RFCOMM failed", e);
            if (e instanceof IOException) last = (IOException) e;
            else last = new IOException(e.getMessage() != null ? e.getMessage() : "connect failed", e);
        }

        throw last != null ? last : new IOException("connect failed");
    }

    private IOException tryConnect(BluetoothSocket s, String label) {
        connectingRef.set(s);
        try {
            s.connect();
            return null;
        } catch (IOException e) {
            Log.w(TAG, label + " failed", e);
            safeClose(connectingRef.getAndSet(null));
            return e;
        }
    }

    private BluetoothSocket takeConnectingSocket() throws IOException {
        BluetoothSocket s = connectingRef.getAndSet(null);
        if (s == null || !s.isConnected()) {
            safeClose(s);
            throw new IOException("connect failed");
        }
        return s;
    }

    private void closeSocket() {
        BluetoothSocket s = socketRef.getAndSet(null);
        safeClose(s);
    }

    private static void safeClose(BluetoothSocket s) {
        if (s == null) return;
        try {
            s.close();
        } catch (IOException ignored) {
        }
    }

    @SuppressLint("MissingPermission")
    private void stopDiscoveryInternal() {
        try {
            BluetoothAdapter adapter = getAdapter();
            if (adapter != null) {
                try {
                    if (adapter.isDiscovering()) {
                        adapter.cancelDiscovery();
                    }
                } catch (SecurityException e) {
                    Log.w(TAG, "cancelDiscovery", e);
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "stopDiscoveryInternal adapter", e);
        }
        if (discoveryReceiver != null) {
            try {
                Context ctx = getActivity() != null ? getActivity() : getContext();
                ctx.unregisterReceiver(discoveryReceiver);
            } catch (Exception ignored) {
            }
            discoveryReceiver = null;
        }
    }

    @SuppressLint("MissingPermission")
    private JSObject deviceToJson(BluetoothDevice device, boolean bonded) {
        JSObject o = new JSObject();
        String address = "";
        try {
            address = device.getAddress();
        } catch (SecurityException ignored) {
        }
        o.put("address", address);
        String name = null;
        try {
            name = device.getName();
        } catch (SecurityException ignored) {
        }
        o.put("name", name != null && !name.isEmpty() ? name : address);
        o.put("bonded", bonded);
        return o;
    }

    @Override
    protected void handleOnDestroy() {
        stopDiscoveryInternal();
        closeSocket();
        io.shutdownNow();
        super.handleOnDestroy();
    }
}
