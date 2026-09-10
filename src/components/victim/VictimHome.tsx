import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { HardwareStatusStrip } from '../common/HardwareStatusStrip';
import { SosTrackerCard } from '../common/SosTrackerCard';
import { geoService } from '../../services/geoService';
import { rateLimiter } from '../../services/rateLimiter';
import {
  AlertTriangle,
  Radio,
  MapPin,
  MessageSquare,
  Map,
  ShieldCheck,
  CheckCircle2,
  Lock
} from 'lucide-react';

interface Props {
  onNavigateToMap: () => void;
  onNavigateToMessages: () => void;
  onNavigateToMesh: () => void;
  onInspectPacket?: (sosId: string) => void;
}

export const VictimHome: React.FC<Props> = ({
  onNavigateToMap,
  onNavigateToMessages,
  onNavigateToMesh,
  onInspectPacket
}) => {
  const {
    location,
    updateLocation,
    meshStatus,
    simpleNetworkStatus,
    disasterZones,
    rateLimitState,
    victimActiveSos,
    sendSos,
    markSafe,
    isNative,
    isGpsReal
  } = useApp();

  const [isSending, setIsSending] = useState(false);
  const [showDangerDetails, setShowDangerDetails] = useState(false);

  // Compute live proximity to disaster
  const riskEval = geoService.evaluateDisasterRisk(
    location.latitude,
    location.longitude,
    disasterZones
  );

  const handleSosClick = async () => {
    if (isSending) return;
    setIsSending(true);
    try {
      await sendSos();
    } finally {
      setIsSending(false);
    }
  };

  const handleSafeClick = async () => {
    if (isSending) return;
    setIsSending(true);
    try {
      await markSafe();
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="victim-home-container">
      {/* App Branding */}
      <div className="app-header-simple">
        <h1 className="app-header-title">LIFELINE</h1>
        <span className="app-header-subtitle">Offline Disaster Rescue Network</span>
      </div>

      {/* Hardware Status Strip */}
      <HardwareStatusStrip />

      {/* Simple Clean Network Status Card */}
      <div 
        onClick={onNavigateToMesh}
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-card-highlight)',
          borderRadius: 14,
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          cursor: 'pointer',
          boxShadow: '0 4px 16px rgba(0,0,0,0.3)'
        }}
        title="Tap to open Mesh Network Topology Portal"
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: '#94A3B8', letterSpacing: 1 }}>
            📡 NETWORK STATUS
          </span>
          <span style={{
            fontSize: 10,
            fontWeight: 800,
            color: '#38BDF8',
            background: 'rgba(56, 189, 248, 0.12)',
            padding: '2px 8px',
            borderRadius: 6,
            border: '1px solid rgba(56, 189, 248, 0.3)'
          }}>
            Topology 📡 →
          </span>
        </div>

        <div style={{ fontSize: 15, fontWeight: 900 }}>
          {simpleNetworkStatus === 'CONNECTED' && (
            <span style={{ color: '#10B981' }}>🟢 CONNECTED</span>
          )}
          {simpleNetworkStatus === 'SEARCHING' && (
            <span style={{ color: '#F59E0B' }}>🟡 SEARCHING FOR NEARBY DEVICE...</span>
          )}
          {simpleNetworkStatus === 'WAITING_RELAY' && (
            <span style={{ color: '#F59E0B' }}>⏳ WAITING FOR RELAY...</span>
          )}
          {simpleNetworkStatus === 'FORWARDED' && (
            <span style={{ color: '#10B981' }}>🟢 SOS FORWARDED</span>
          )}
          {simpleNetworkStatus === 'DELIVERED' && (
            <span style={{ color: '#38BDF8' }}>✓ RESCUE CENTER REACHED</span>
          )}
        </div>
      </div>

      {/* Location & Hazard Overview */}
      <div className="telemetry-card-simple">
        {/* Location Display */}
        <div className="telemetry-row">
          <div className="telemetry-label">
            <MapPin size={15} color={isGpsReal ? '#10B981' : '#38BDF8'} />
            <span>📍 LOCATION</span>
            <span style={{
              fontSize: 9,
              fontWeight: 800,
              padding: '1px 5px',
              borderRadius: 4,
              background: isGpsReal ? 'rgba(16, 185, 129, 0.2)' : 'rgba(148, 163, 184, 0.2)',
              color: isGpsReal ? '#10B981' : '#94A3B8'
            }}>
              {isGpsReal ? 'REAL GPS' : 'DEMO LOCATION'}
            </span>
          </div>
          <div className="telemetry-value">
            {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
          </div>
        </div>

        {/* Proximity Risk Level: RED, YELLOW, GREEN */}
        <div className="telemetry-row" style={{
          background: riskEval.riskLevel === 'CRITICAL'
            ? 'rgba(239,68,68,0.18)'
            : riskEval.riskLevel === 'WARNING'
            ? 'rgba(245,158,11,0.18)'
            : 'rgba(16,185,129,0.18)',
          padding: '8px 10px',
          borderRadius: 8,
          border: `1px solid ${
            riskEval.riskLevel === 'CRITICAL'
              ? 'rgba(239,68,68,0.4)'
              : riskEval.riskLevel === 'WARNING'
              ? 'rgba(245,158,11,0.4)'
              : 'rgba(16,185,129,0.4)'
          }`
        }}>
          <div className="telemetry-label" style={{
            color: riskEval.riskLevel === 'CRITICAL'
              ? '#EF4444'
              : riskEval.riskLevel === 'WARNING'
              ? '#F59E0B'
              : '#10B981',
            fontWeight: 700
          }}>
            <AlertTriangle size={15} />
            <span>
              {riskEval.riskLevel === 'CRITICAL' && '🔴 RED ZONE'}
              {riskEval.riskLevel === 'WARNING' && '🟡 YELLOW ZONE'}
              {riskEval.riskLevel === 'SAFE' && '🟢 GREEN ZONE'}
            </span>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{
              fontSize: 10,
              fontWeight: 800,
              color: riskEval.riskLevel === 'CRITICAL'
                ? '#FCA5A5'
                : riskEval.riskLevel === 'WARNING'
                ? '#FDE68A'
                : '#A7F3D0'
            }}>
              AUTO PRIORITY: {riskEval.riskLevel === 'CRITICAL' ? 'CRITICAL' : riskEval.riskLevel === 'WARNING' ? 'HIGH' : 'LOW'}
            </div>
            <div style={{ fontSize: 10, color: '#94A3B8' }}>
              {riskEval.distanceKm} km from {riskEval.closestZone.type}
            </div>
          </div>
        </div>

        {/* Quick GPS Zone Simulator (browser demo only: hidden in native runtime) */}
        {!isNative && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 6,
            marginTop: 2,
            padding: '4px 6px',
            background: 'rgba(255,255,255,0.03)',
            borderRadius: 6,
            fontSize: 10
          }}>
            <span style={{ color: '#64748B', fontWeight: 600 }}>Simulate Zone:</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                onClick={() => updateLocation({ latitude: 22.9780, longitude: 88.4380 })}
                style={{
                  background: riskEval.riskLevel === 'CRITICAL' ? 'rgba(239,68,68,0.35)' : 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(239,68,68,0.4)',
                  color: '#EF4444',
                  padding: '2px 6px',
                  borderRadius: 4,
                  fontSize: 10,
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
                title="Move victim to RED / CRITICAL Zone (Flood breach)"
              >
                🔴 RED
              </button>
              <button
                onClick={() => updateLocation({ latitude: 22.9660, longitude: 88.4320 })}
                style={{
                  background: riskEval.riskLevel === 'WARNING' ? 'rgba(245,158,11,0.35)' : 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(245,158,11,0.4)',
                  color: '#F59E0B',
                  padding: '2px 6px',
                  borderRadius: 4,
                  fontSize: 10,
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
                title="Move victim to YELLOW / WARNING Zone (Perimeter)"
              >
                🟡 YELLOW
              </button>
              <button
                onClick={() => updateLocation({ latitude: 22.9450, longitude: 88.4000 })}
                style={{
                  background: riskEval.riskLevel === 'SAFE' ? 'rgba(16,185,129,0.35)' : 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(16,185,129,0.4)',
                  color: '#10B981',
                  padding: '2px 6px',
                  borderRadius: 4,
                  fontSize: 10,
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
                title="Move victim to GREEN / SAFE Zone (Outside danger area)"
              >
                🟢 GREEN
              </button>
            </div>
          </div>
        )}
      </div>

      {/* GIANT SOS BUTTON (Zero-questionnaire, instant trigger) */}
      <div className="sos-button-section">
        <button
          className={`giant-sos-btn ${victimActiveSos ? 'pulsing' : ''}`}
          onClick={handleSosClick}
          disabled={isSending || !rateLimitState.canSend}
          title="Press for immediate emergency rescue"
        >
          <div style={{ fontSize: 26, lineHeight: 1 }}>🚨</div>
          <span className="sos-text-main">SOS</span>
          <span className="sos-text-sub">
            {isSending ? 'ENCRYPTING...' : 'SEND SOS'}
          </span>
        </button>
      </div>

      {/* SOS Rate Limit Indicator */}
      <div className="sos-limit-strip">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Lock size={13} color="#94A3B8" />
          <span style={{ color: '#94A3B8', fontWeight: 600 }}>SOS AVAILABLE:</span>
          <span className={`limit-badge-count ${!rateLimitState.canSend ? 'exhausted' : ''}`}>
            {rateLimitState.maxAllowed - rateLimitState.countInWindow} / {rateLimitState.maxAllowed}
          </span>
        </div>

        {!rateLimitState.canSend ? (
          <span style={{ color: '#EF4444', fontWeight: 700, fontSize: 11 }}>
            Resets in {rateLimiter.formatRemainingTime(rateLimitState.cooldownRemainingSeconds)}
          </span>
        ) : (
          <span style={{ color: '#10B981', fontSize: 11, fontWeight: 600 }}>
            1-Hour Window Active
          </span>
        )}
      </div>

      {/* If Rate Limit reached, show banner */}
      {!rateLimitState.canSend && (
        <div style={{
          background: 'rgba(239,68,68,0.15)',
          border: '1px solid rgba(239,68,68,0.4)',
          borderRadius: 12,
          padding: '10px',
          fontSize: 12,
          color: '#FECACA',
          display: 'flex',
          flexDirection: 'column',
          gap: 4
        }}>
          <div style={{ fontWeight: 800, color: '#EF4444' }}>⚠️ SOS LIMIT REACHED</div>
          <div>You have used 2 SOS requests in the current 1-hour period. Please wait until the limit resets.</div>
          <div style={{ fontSize: 11, opacity: 0.85 }}>You can still receive incoming alerts and chat messages.</div>
        </div>
      )}

      {/* Active SOS Tracker if one exists */}
      {victimActiveSos && (
        <SosTrackerCard
          packet={victimActiveSos}
          onInspect={onInspectPacket ? () => onInspectPacket(victimActiveSos.id) : undefined}
        />
      )}

      {/* Quick Actions Grid */}
      <div className="quick-actions-grid">
        <button 
          className="action-card-btn" 
          onClick={onNavigateToMesh}
          style={{ borderColor: 'rgba(56, 189, 248, 0.4)', background: 'rgba(56, 189, 248, 0.08)' }}
        >
          <Radio size={18} color="#38BDF8" />
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#FFF' }}>Mesh Portal</div>
            <div style={{ fontSize: 10, color: '#38BDF8' }}>A → B → C → D Relay</div>
          </div>
        </button>

        <button className="action-card-btn" onClick={onNavigateToMessages}>
          <MessageSquare size={18} color="#38BDF8" />
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontWeight: 700, fontSize: 13 }}>Send Message</div>
            <div style={{ fontSize: 10, color: '#94A3B8' }}>1-Tap Presets</div>
          </div>
        </button>

        <button className="action-card-btn" onClick={onNavigateToMap}>
          <Map size={18} color="#A78BFA" />
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontWeight: 700, fontSize: 13 }}>Live Map</div>
            <div style={{ fontSize: 10, color: '#94A3B8' }}>Offline GPS</div>
          </div>
        </button>

        <button className="action-card-btn safe-btn" onClick={handleSafeClick}>
          <CheckCircle2 size={18} color="#10B981" />
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#10B981' }}>I'm Safe</div>
            <div style={{ fontSize: 10, color: '#A7F3D0' }}>Broadcast Status</div>
          </div>
        </button>
      </div>

      {/* Expanded Danger Details */}
      {showDangerDetails && (
        <div style={{
          background: 'rgba(245, 158, 11, 0.1)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          borderRadius: 14,
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          fontSize: 12
        }}>
          <div style={{ fontWeight: 800, color: '#F59E0B', display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlertTriangle size={15} />
            <span>Active Hazard Zones</span>
          </div>
          {disasterZones.map((z, idx) => {
            const dist = geoService.evaluateDisasterRisk(location.latitude, location.longitude, [z]);
            return (
              <div key={idx} style={{
                background: 'rgba(0,0,0,0.3)',
                padding: '8px',
                borderRadius: 8,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <div style={{ fontWeight: 700, color: '#FFF' }}>{z.name}</div>
                  <div style={{ fontSize: 10, color: '#94A3B8' }}>{z.description}</div>
                </div>
                <span style={{
                  padding: '3px 8px',
                  borderRadius: 6,
                  fontWeight: 800,
                  fontSize: 11,
                  background: dist.riskLevel === 'CRITICAL' ? '#EF4444' : '#F59E0B',
                  color: '#FFF'
                }}>
                  {dist.distanceKm} km
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
