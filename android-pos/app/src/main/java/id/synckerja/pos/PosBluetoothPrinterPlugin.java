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
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Classic Bluetooth SPP bridge for thermal POS printers (e.g. RPP02N).
 */
@CapacitorPlugin(
    name = "PosBluetoothPrinter",
    permissions = {
        @Permission(
            alias = "bluetooth",
            strings = {
                Manifest.permission.BLUETOOTH,
                Manifest.permission.BLUETOOTH_ADMIN,
                Manifest.permission.BLUETOOTH_CONNECT,
                Manifest.permission.BLUETOOTH_SCAN,
                Manifest.permission.ACCESS_FINE_LOCATION
            }
        )
    }
)
public class PosBluetoothPrinterPlugin extends Plugin {

    private static final String TAG = "PosBluetoothPrinter";
    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");

    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private final Handler main = new Handler(Looper.getMainLooper());
    private BluetoothSocket socket;
    private BroadcastReceiver discoveryReceiver;
    private boolean discovering = false;

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("available", getAdapter() != null);
        call.resolve(ret);
    }

    @PluginMethod
    public void getAdapterState(PluginCall call) {
        BluetoothAdapter adapter = getAdapter();
        JSObject ret = new JSObject();
        ret.put("enabled", adapter != null && adapter.isEnabled());
        call.resolve(ret);
    }

    @PluginMethod
    public void requestEnable(PluginCall call) {
        BluetoothAdapter adapter = getAdapter();
        if (adapter == null) {
            call.reject("Bluetooth not supported");
            return;
        }
        if (adapter.isEnabled()) {
            JSObject ret = new JSObject();
            ret.put("enabled", true);
            call.resolve(ret);
            return;
        }
        try {
            Intent intent = new Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
        } catch (Exception e) {
            Log.w(TAG, "requestEnable startActivity", e);
        }
        JSObject ret = new JSObject();
        ret.put("enabled", adapter.isEnabled());
        call.resolve(ret);
    }

    @SuppressLint("MissingPermission")
    @PluginMethod
    public void listBondedDevices(PluginCall call) {
        if (!ensureBluetoothPermission(call, "listBondedDevices")) return;
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
    }

    @SuppressLint("MissingPermission")
    @PluginMethod
    public void startDiscovery(PluginCall call) {
        if (!ensureBluetoothPermission(call, "startDiscovery")) return;
        BluetoothAdapter adapter = getAdapter();
        if (adapter == null) {
            call.reject("Bluetooth not supported");
            return;
        }
        if (!adapter.isEnabled()) {
            call.reject("Bluetooth is off");
            return;
        }
        stopDiscoveryInternal();
        discoveryReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                String action = intent.getAction();
                if (BluetoothDevice.ACTION_FOUND.equals(action)) {
                    BluetoothDevice device = intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE);
                    if (device == null) return;
                    notifyListeners("deviceFound", deviceToJson(device, device.getBondState() == BluetoothDevice.BOND_BONDED));
                } else if (BluetoothAdapter.ACTION_DISCOVERY_FINISHED.equals(action)) {
                    discovering = false;
                    notifyListeners("discoveryFinished", new JSObject());
                }
            }
        };
        IntentFilter filter = new IntentFilter();
        filter.addAction(BluetoothDevice.ACTION_FOUND);
        filter.addAction(BluetoothAdapter.ACTION_DISCOVERY_FINISHED);
        getContext().registerReceiver(discoveryReceiver, filter);
        discovering = true;
        // Emit bonded devices immediately so UI has something to pick
        Set<BluetoothDevice> bonded = adapter.getBondedDevices();
        if (bonded != null) {
            for (BluetoothDevice device : bonded) {
                notifyListeners("deviceFound", deviceToJson(device, true));
            }
        }
        adapter.startDiscovery();
        call.resolve();
    }

    @SuppressLint("MissingPermission")
    @PluginMethod
    public void stopDiscovery(PluginCall call) {
        stopDiscoveryInternal();
        call.resolve();
    }

    @PluginMethod
    public void connect(PluginCall call) {
        if (!ensureBluetoothPermission(call, "connect")) return;
        String address = call.getString("address");
        if (address == null || address.isEmpty()) {
            call.reject("address required");
            return;
        }
        io.execute(() -> {
            try {
                connectInternal(address);
                main.post(call::resolve);
            } catch (Exception e) {
                Log.e(TAG, "connect failed", e);
                main.post(() -> call.reject(e.getMessage() != null ? e.getMessage() : "connect failed"));
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
                BluetoothSocket s = socket;
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
        if (getPermissionState("bluetooth") == com.getcapacitor.PermissionState.GRANTED) {
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
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (ActivityCompat.checkSelfPermission(getContext(), Manifest.permission.BLUETOOTH_CONNECT)
                    != PackageManager.PERMISSION_GRANTED
                || ActivityCompat.checkSelfPermission(getContext(), Manifest.permission.BLUETOOTH_SCAN)
                    != PackageManager.PERMISSION_GRANTED) {
                requestPermissionForAlias("bluetooth", call, "bluetoothPermsCallback");
                return false;
            }
        }
        return true;
    }

    private BluetoothAdapter getAdapter() {
        BluetoothManager mgr = (BluetoothManager) getContext().getSystemService(Context.BLUETOOTH_SERVICE);
        if (mgr != null) return mgr.getAdapter();
        return BluetoothAdapter.getDefaultAdapter();
    }

    @SuppressLint("MissingPermission")
    private void connectInternal(String address) throws IOException {
        closeSocket();
        BluetoothAdapter adapter = getAdapter();
        if (adapter == null) throw new IOException("Bluetooth not supported");
        if (adapter.isDiscovering()) adapter.cancelDiscovery();
        BluetoothDevice device = adapter.getRemoteDevice(address);
        BluetoothSocket s;
        try {
            s = device.createRfcommSocketToServiceRecord(SPP_UUID);
            s.connect();
        } catch (IOException first) {
            try {
                // Fallback reflection for some cheap printers
                s = (BluetoothSocket) device.getClass()
                    .getMethod("createRfcommSocket", int.class)
                    .invoke(device, 1);
                s.connect();
            } catch (Exception second) {
                throw first;
            }
        }
        socket = s;
    }

    private void closeSocket() {
        try {
            if (socket != null) {
                socket.close();
            }
        } catch (IOException ignored) {
        }
        socket = null;
    }

    @SuppressLint("MissingPermission")
    private void stopDiscoveryInternal() {
        BluetoothAdapter adapter = getAdapter();
        if (adapter != null && adapter.isDiscovering()) {
            adapter.cancelDiscovery();
        }
        if (discoveryReceiver != null) {
            try {
                getContext().unregisterReceiver(discoveryReceiver);
            } catch (Exception ignored) {
            }
            discoveryReceiver = null;
        }
        discovering = false;
    }

    @SuppressLint("MissingPermission")
    private JSObject deviceToJson(BluetoothDevice device, boolean bonded) {
        JSObject o = new JSObject();
        o.put("address", device.getAddress());
        String name = null;
        try {
            name = device.getName();
        } catch (SecurityException ignored) {
        }
        o.put("name", name != null && !name.isEmpty() ? name : device.getAddress());
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
