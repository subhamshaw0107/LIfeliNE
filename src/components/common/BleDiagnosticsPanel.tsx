import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { demoMeshNetwork } from '../../services/demoMeshNetwork';
import type { BleDiagnostics } from '../../transport/bleMeshTransport';

/**
 * Developer-only BLE/GPS diagnostics panel.
 * Rendered exclusively in dev builds (import.meta.env.DEV) — never in
 * production. Shows live radio + GPS state for two-phone field testing.
 * Displays peer UUIDs only (public mesh identities); never keys or secrets.
 */
export const BleDiagnosticsPanel: React.FC = () => {
  const { location, isGpsReal, meshStatus, realPeerIds } = useApp();
  const [ble, setBle] = useState<BleDiagnostics | null>(null);

  useEffect(() => {
    const poll = () => {
      try {
        setBle(demoMeshNetwork.getBleDiagnostics());
      } catch {
        // diagnostics must never break the app
      }
    };
    poll();
    const timer = setInterval(poll, 1000);
    return () => clearInterval(timer);
  }, []);

  const row = (label: string, value: string) => (
    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '2px 0' }}>
      <span style={{ color: '#64748B', fontWeight: 600 }}>{label}</span>
      <span style={{ color: '#0F172A', fontWeight: 700, fontFamily: 'monospace', textAlign: 'right', maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</span>
    </div>
  );

  const fmtTime = (at: number | null) => (at ? new Date(at).toLocaleTimeString() : '—');
  const shortId = (id: string | null) => (!id ? 'NONE' : id.length > 18 ? `${id.slice(0, 12)}…` : id);

  return (
    <div style={{ background: '#0F172A', borderRadius: 12, padding: '10px 12px', marginTop: 4 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: '#FBBF24', letterSpacing: 1, marginBottom: 4 }}>
        🛠 DEV DIAGNOSTICS (dev builds only)
      </div>
      <div style={{ fontSize: 10, fontWeight: 800, color: '#38BDF8', marginTop: 4 }}>BLE</div>
      {row('Initialization', ble ? (ble.initialized ? 'SUCCESS' : 'NOT STARTED') : 'NO BLE TRANSPORT (mock)')}
      {row('Permissions', ble == null ? 'N/A (mock)' : ble.permissionsGranted === null ? 'UNKNOWN' : ble.permissionsGranted ? 'GRANTED' : 'DENIED')}
      {row('Advertising', ble ? (ble.advertising ? 'ON' : 'OFF') : 'N/A (mock)')}
      {row('Scanning', ble ? (ble.scanning ? 'ON' : 'OFF') : 'N/A (mock)')}
      {row('Discovered peers', ble ? String(ble.discoveredCount) : 'N/A (mock)')}
      {row('Connected peers', String(realPeerIds.length))}
      {row('Local peer ID', ble ? shortId(ble.localPeerId) : 'N/A (mock)')}
      {row('Last peer discovered', ble ? shortId(ble.lastPeerFound) : 'NONE')}
      {row('Last connection state', ble ? ble.lastConnectionState : 'N/A (mock)')}
      {row('Last packet received', ble?.lastPacketReceived ? `${shortId(ble.lastPacketReceived.peerId)} ${ble.lastPacketReceived.bytes}B @ ${fmtTime(ble.lastPacketReceived.at)}` : 'NONE')}
      {row('Last packet sent', ble?.lastPacketSent ? `${shortId(ble.lastPacketSent.peerId)} ${ble.lastPacketSent.bytes}B ok=${ble.lastPacketSent.ok} @ ${fmtTime(ble.lastPacketSent.at)}` : 'NONE')}
      {row('App mesh status', meshStatus)}
      <div style={{ fontSize: 10, fontWeight: 800, color: '#38BDF8', marginTop: 6 }}>GPS</div>
      {row('Provider initialized', 'YES')}
      {row('Real GPS fix', isGpsReal ? 'YES' : 'NO')}
      {row('Latitude', String(location.latitude))}
      {row('Longitude', String(location.longitude))}
      {row('Accuracy', `±${location.accuracy}m`)}
      {row('Last GPS update', fmtTime(location.lastUpdated))}
    </div>
  );
};
