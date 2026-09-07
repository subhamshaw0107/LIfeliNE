package com.lifeline.mesh;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;
import com.lifeline.mesh.transport.BleMeshPlugin;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Registers the LIFELINE BLE mesh plugin (M2 transport).
        // Web fallback: absent on browser builds, where MockMeshTransport runs.
        registerPlugin(BleMeshPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
