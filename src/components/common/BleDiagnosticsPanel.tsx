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
  const { location, isGpsReal, meshStatus, realPeerIds, user } = useApp();
  const [ble, setBle] = useState<BleDiagnostics | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  useEffect(() => {
    const poll = () => {
      try {
        setBle(demoMeshNetwork.getBleDiagnostics());
        setStats(demoMeshNetwork.getEngineStats());
      } catch {
        // diagnostics must never break the app
      }
    };
    poll();
    const timer = setInterval(poll, 1000);
    return () => clearInterval(timer);
  }, []);

  const row = (label: string, value: string, highlight?: boolean) => (
    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <span style={{ color: '#94A3B8', fontWeight: 600 }}>{label}</span>
      <span style={{ color: highlight ? '#10B981' : '#F8FAFC', fontWeight: 700, fontFamily: 'monospace', textAlign: 'right', maxWidth: '65%', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</span>
    </div>
  );

  const fmtTime = (at: number | null) => (at ? new Date(at).toLocaleTimeString() : '—');
  const shortId = (id: string | null) => (!id ? 'NONE' : id.length > 18 ? `${id.slice(0, 10)}…${id.slice(-4)}` : id);

  return (
    <div style={{ background: '#0F172A', borderRadius: 12, border: '1px solid #334155', padding: '12px 14px', marginTop: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.4)' }}>
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
      >
        <div style={{ fontSize: 11, fontWeight: 900, color: '#FBBF24', letterSpacing: 0.8, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>🛠 BLE MESH DIAGNOSTICS & TEST MODE</span>
          <span style={{ fontSize: 9, background: ble?.initialized ? '#059669' : '#475569', color: '#FFF', padding: '1px 6px', borderRadius: 6 }}>
            {ble?.initialized ? '🟢 REAL BLE' : '⚪ DEMO / MOCK'}
          </span>
        </div>
        <span style={{ fontSize: 11, color: '#94A3B8' }}>{isExpanded ? '▲ Hide' : '▼ View Details'}</span>
      </div>

      {isExpanded && (
        <div style={{ marginTop: 10 }}>
          {/* BLE Hardware & Radio Status */}
          <div style={{ fontSize: 10, fontWeight: 900, color: '#38BDF8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
            📡 BLE Hardware & Discovery Status
          </div>
          {row('Device ID', shortId(ble?.localPeerId || user?.phoneId || 'DEV-NODE'))}
          {row('BLE Radio Status', ble ? (ble.initialized ? '🟢 AVAILABLE / ON' : '🔴 NOT READY') : '⚪ MOCK MODE (Browser)', ble?.initialized)}
          {row('Permissions', ble == null ? 'N/A (Mock)' : ble.permissionsGranted === true ? '🟢 GRANTED' : '🔴 DENIED', ble?.permissionsGranted === true)}
          {row('Scanning Status', ble?.scanning ? '🟢 SCANNING' : '⚪ IDLE', ble?.scanning)}
          {row('Advertising Status', ble?.advertising ? '🟢 BROADCASTING' : '⚪ IDLE', ble?.advertising)}
          {row('Nearby Discovered Peers', `${ble?.discoveredCount ?? 0} found`)}
          {row('Connected Peer Devices', `${realPeerIds.length} connected (${realPeerIds.map(p => shortId(p)).join(', ') || 'None'})`, realPeerIds.length > 0)}
          {row('Last Discovered Peer', shortId(ble?.lastPeerFound || null))}
          {row('Link Connection State', ble?.lastConnectionState || 'IDLE')}

          {/* Real SOS Propagation & Relay Statistics */}
          <div style={{ fontSize: 10, fontWeight: 900, color: '#F43F5E', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 10, marginBottom: 4 }}>
            🚨 Multi-Hop Relay & Store-Carry-Forward
          </div>
          {row('SOS Messages Received', stats?.messagesReceived > 0 ? `🟢 YES (${stats.messagesReceived})` : '⚪ NONE (0)', stats?.messagesReceived > 0)}
          {row('SOS Messages Relayed', stats?.messagesRelayed > 0 ? `🟢 YES (${stats.messagesRelayed})` : '⚪ NONE (0)', stats?.messagesRelayed > 0)}
          {row('Messages Dropped / Loop / TTL', String(stats?.messagesDropped ?? 0))}
          {row('Messages in Queue (Pending)', String(stats?.queueSize ?? 0), (stats?.queueSize ?? 0) > 0)}
          {row('Last Message Hop Count', String(stats?.lastHopCount ?? 0))}
          {row('Last Message ID', shortId(stats?.lastMessageId ?? null))}
          {row('Last Message Received At', fmtTime(stats?.lastMessageTime ?? null))}
          {row('Last Radio Tx', ble?.lastPacketSent ? `${shortId(ble.lastPacketSent.peerId)} (${ble.lastPacketSent.bytes}B) @ ${fmtTime(ble.lastPacketSent.at)}` : 'NONE')}
          {row('Last Radio Rx', ble?.lastPacketReceived ? `${shortId(ble.lastPacketReceived.peerId)} (${ble.lastPacketReceived.bytes}B) @ ${fmtTime(ble.lastPacketReceived.at)}` : 'NONE')}

          {/* GPS Telemetry */}
          <div style={{ fontSize: 10, fontWeight: 900, color: '#10B981', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 10, marginBottom: 4 }}>
            📍 GPS Geolocation
          </div>
          {row('Real GPS Hardware Fix', isGpsReal ? '🟢 PHYSICAL GPS' : '⚪ ESTIMATED', isGpsReal)}
          {row('Coordinates', `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`)}
          {row('Accuracy Radius', `±${location.accuracy}m`)}
          {row('Last Fix Timestamp', fmtTime(location.lastUpdated))}
        </div>
      )}
    </div>
  );
};
