import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { geoService, SAFE_SHELTERS, haversineDistanceKm } from '../../services/geoService';
import {
  AlertTriangle,
  Radio,
  MapPin,
  Map,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Home,
  MessageSquare,
  Compass,
  AlertOctagon,
  ChevronRight,
  Ambulance,
  Info
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
    disasterZones,
    rateLimitState,
    victimActiveSos,
    sendSos,
    markSafe
  } = useApp();

  const [isSending, setIsSending] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0); // 0 to 100%
  const [isHolding, setIsHolding] = useState(false);
  const [tapHint, setTapHint] = useState<string | null>(null);
  const [activationState, setActivationState] = useState<'IDLE' | 'COUNTDOWN' | 'TRIGGERED'>('IDLE');
  const [countdownNum, setCountdownNum] = useState(2);

  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const holdStartRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);

  // Compute live proximity to disaster zones
  const riskEval = useMemo(() => {
    return geoService.evaluateDisasterRisk(
      location.latitude,
      location.longitude,
      disasterZones
    );
  }, [location.latitude, location.longitude, disasterZones]);

  // Find nearest safe shelter
  const nearestShelter = useMemo(() => {
    if (!SAFE_SHELTERS || SAFE_SHELTERS.length === 0) return null;
    const sheltersWithDist = SAFE_SHELTERS.map((s) => ({
      ...s,
      distKm: haversineDistanceKm(location.latitude, location.longitude, s.latitude, s.longitude)
    }));
    sheltersWithDist.sort((a, b) => a.distKm - b.distKm);
    return sheltersWithDist[0];
  }, [location.latitude, location.longitude]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  // SOS activation trigger
  const triggerSosActivation = async () => {
    if (isSending) return;
    setIsSending(true);
    setActivationState('TRIGGERED');

    // Haptic buzz on mobile devices if supported
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([150, 80, 250]);
      } catch {
        // ignore if not supported
      }
    }

    try {
      await sendSos();
    } finally {
      setIsSending(false);
      setHoldProgress(0);
      setIsHolding(false);
      setActivationState('IDLE');
    }
  };

  // Press-and-hold handlers for SOS button (2 seconds required)
  const startHold = (e: React.MouseEvent | React.TouchEvent) => {
    // Prevent default touch gestures to ensure smooth holding
    if (e.type === 'touchstart') {
      // Allow touch to register without scrolling the button
    }

    if (victimActiveSos) {
      // Already active - immediate inspection or status feedback
      return;
    }

    if (!rateLimitState.canSend) {
      setTapHint('SOS rate limit active. Please wait for cooldown.');
      setTimeout(() => setTapHint(null), 3000);
      return;
    }

    setIsHolding(true);
    setTapHint(null);
    holdStartRef.current = Date.now();

    const updateLoop = () => {
      const elapsed = Date.now() - holdStartRef.current;
      const progress = Math.min(100, (elapsed / 2000) * 100);
      setHoldProgress(progress);

      if (progress < 100) {
        animationFrameRef.current = requestAnimationFrame(updateLoop);
      } else {
        // 2 seconds complete! Trigger SOS
        triggerSosActivation();
      }
    };

    animationFrameRef.current = requestAnimationFrame(updateLoop);
  };

  const cancelHold = () => {
    if (!isHolding) return;
    setIsHolding(false);

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    const elapsed = Date.now() - holdStartRef.current;
    setHoldProgress(0);

    // If released prematurely, give friendly coaching
    if (elapsed > 80 && elapsed < 1800 && !victimActiveSos) {
      setTapHint('Press and hold for 2 full seconds to trigger emergency SOS');
      setTimeout(() => setTapHint(null), 3500);
    }
  };

  // Safe Broadcast Action
  const handleMarkSafe = async () => {
    if (isSending) return;
    setIsSending(true);
    try {
      await markSafe();
    } finally {
      setIsSending(false);
    }
  };

  // Delivery status flags for the active SOS card
  const hasRelayConnected = useMemo(() => {
    if (!victimActiveSos) return false;
    return (
      victimActiveSos.hopCount > 0 ||
      (victimActiveSos.route && victimActiveSos.route.length > 1) ||
      ['RELAYING', 'DELIVERED', 'ACKNOWLEDGED', 'RESPONDING', 'RESCUED'].includes(
        victimActiveSos.status
      )
    );
  }, [victimActiveSos]);

  const isRescueNotified = useMemo(() => {
    if (!victimActiveSos) return false;
    return ['DELIVERED', 'ACKNOWLEDGED', 'RESPONDING', 'RESCUED'].includes(victimActiveSos.status);
  }, [victimActiveSos]);

  const isResponderAssigned = useMemo(() => {
    if (!victimActiveSos) return false;
    return ['RESPONDING', 'RESCUED'].includes(victimActiveSos.status);
  }, [victimActiveSos]);

  return (
    <div className="victim-home-clean">
      {/* 1. TOP HEADER */}
      <header className="victim-top-header">
        <div className="victim-header-title-wrap">
          <h1 className="victim-app-title">LIFELINE</h1>
          <p className="victim-app-tagline">Offline Disaster Rescue Network</p>
        </div>
        <div className="victim-ready-badge" title="Bluetooth & Wi-Fi Direct Mesh is Active">
          <span className="ready-pulsing-dot" />
          <span className="ready-text">Offline • Rescue Network Ready</span>
        </div>
      </header>

      {/* 2. SAFETY STATUS CARD */}
      <section
        className={`safety-status-card safety-${riskEval.riskLevel.toLowerCase()}`}
        aria-label="Safety status"
      >
        <div className="safety-card-left">
          <div className="safety-icon-wrapper">
            {riskEval.riskLevel === 'CRITICAL' && <AlertTriangle size={24} className="hazard-pulse" />}
            {riskEval.riskLevel === 'WARNING' && <AlertTriangle size={24} />}
            {riskEval.riskLevel === 'SAFE' && <ShieldCheck size={24} />}
          </div>
          <div className="safety-text-content">
            <h2 className="safety-headline">
              {riskEval.riskLevel === 'CRITICAL' && 'YOU ARE IN DANGER'}
              {riskEval.riskLevel === 'WARNING' && 'WARNING: NEAR HAZARD'}
              {riskEval.riskLevel === 'SAFE' && 'YOU ARE SAFE'}
            </h2>
            <p className="safety-subheadline">
              {riskEval.riskLevel === 'CRITICAL' &&
                (riskEval.distanceKm <= 0.1
                  ? `${riskEval.closestZone.name} • Inside Hazard Zone`
                  : `${riskEval.closestZone.name} • ${riskEval.distanceKm} km away`)}
              {riskEval.riskLevel === 'WARNING' &&
                `Near ${riskEval.closestZone.name} • ${riskEval.distanceKm} km away`}
              {riskEval.riskLevel === 'SAFE' && 'Green Zone • Safe Area'}
            </p>
          </div>
        </div>

        {/* Discreet zone simulator for hackathon testing & demonstrations */}
        <div className="safety-zone-simulator" title="Simulate different disaster zones for testing">
          <span className="sim-label">Simulate:</span>
          <button
            type="button"
            className={`sim-pill red ${riskEval.riskLevel === 'CRITICAL' ? 'active' : ''}`}
            onClick={() => updateLocation({ latitude: 22.978, longitude: 88.438 })}
          >
            🔴 Red
          </button>
          <button
            type="button"
            className={`sim-pill yellow ${riskEval.riskLevel === 'WARNING' ? 'active' : ''}`}
            onClick={() => updateLocation({ latitude: 22.966, longitude: 88.432 })}
          >
            🟡 Yellow
          </button>
          <button
            type="button"
            className={`sim-pill green ${riskEval.riskLevel === 'SAFE' ? 'active' : ''}`}
            onClick={() => updateLocation({ latitude: 22.945, longitude: 88.4 })}
          >
            🟢 Green
          </button>
        </div>
      </section>

      {/* 3. PRIMARY SOS ACTION (Large circular button with 2-second press-and-hold) */}
      <section className="primary-sos-section" aria-label="Emergency SOS activation">
        <div className="sos-button-wrapper">
          {/* Circular SVG Progress Ring for the 2-second hold */}
          <svg className="sos-progress-svg" viewBox="0 0 220 220">
            {/* Background track */}
            <circle
              cx="110"
              cy="110"
              r="100"
              className="sos-track-circle"
            />
            {/* Active filling progress ring */}
            <circle
              cx="110"
              cy="110"
              r="100"
              className="sos-fill-circle"
              style={{
                strokeDasharray: 628,
                strokeDashoffset: 628 - (628 * holdProgress) / 100
              }}
            />
          </svg>

          <button
            type="button"
            className={`primary-sos-btn ${victimActiveSos ? 'sos-is-active' : ''} ${
              isHolding ? 'holding' : ''
            }`}
            onMouseDown={startHold}
            onMouseUp={cancelHold}
            onMouseLeave={cancelHold}
            onTouchStart={startHold}
            onTouchEnd={cancelHold}
            onTouchCancel={cancelHold}
            disabled={isSending}
            aria-label="Press and hold for 2 seconds to activate SOS"
          >
            <div className="sos-btn-content">
              <span className="sos-beacon-icon">🆘</span>
              <span className="sos-label-text">SOS</span>
              <span className="sos-sub-instruction">
                {isSending
                  ? 'BROADCASTING...'
                  : victimActiveSos
                  ? 'SOS BROADCASTING'
                  : isHolding
                  ? `${Math.round(holdProgress)}%`
                  : 'HOLD 2 SECONDS'}
              </span>
            </div>
          </button>
        </div>

        <p className="sos-hold-helper-text">
          {victimActiveSos
            ? '🚨 Emergency Beacon Active — Nearby Relays Forwarding'
            : isHolding
            ? 'Keep holding to activate emergency beacon...'
            : 'Press and hold for 2 seconds'}
        </p>

        {/* Cooldown or Tap Warning hint */}
        {tapHint && (
          <div className="sos-tap-hint" role="alert">
            <Info size={14} />
            <span>{tapHint}</span>
          </div>
        )}
      </section>

      {/* 5. RESCUE STATUS (Prominent when an SOS is active) */}
      {victimActiveSos && (
        <section className="rescue-status-card" aria-label="Rescue delivery status">
          <div className="rescue-status-header">
            <div className="rescue-status-title-group">
              <span className="rescue-pulse-dot" />
              <h3 className="rescue-status-title">🚨 SOS ACTIVE</h3>
            </div>
            <span className="rescue-sos-id">ID: {victimActiveSos.id}</span>
          </div>

          <div className="rescue-status-steps">
            <div className="status-step-item completed">
              <CheckCircle2 size={16} className="step-check-icon" />
              <span className="step-text">SOS Sent</span>
            </div>

            <div className={`status-step-item ${hasRelayConnected ? 'completed' : 'waiting'}`}>
              {hasRelayConnected ? (
                <CheckCircle2 size={16} className="step-check-icon" />
              ) : (
                <Clock size={16} className="step-clock-icon" />
              )}
              <span className="step-text">
                {hasRelayConnected ? 'Relay Connected' : 'Connecting to Relay...'}
              </span>
            </div>

            <div className={`status-step-item ${isRescueNotified ? 'completed' : 'waiting'}`}>
              {isRescueNotified ? (
                <CheckCircle2 size={16} className="step-check-icon" />
              ) : (
                <Clock size={16} className="step-clock-icon" />
              )}
              <span className="step-text">
                {isRescueNotified ? 'Rescue Center Notified' : 'Reaching Rescue Center...'}
              </span>
            </div>
          </div>

          {/* Responder assignment banner */}
          {isResponderAssigned && (
            <div className="responder-assigned-banner">
              <Ambulance size={18} className="responder-icon" />
              <div>
                <strong>Responder Assigned</strong>
                <p>Rescue squad is en route to your GPS position.</p>
              </div>
            </div>
          )}

          <div className="rescue-card-actions">
            <button
              type="button"
              className="mark-safe-btn"
              onClick={handleMarkSafe}
              disabled={isSending}
            >
              <ShieldCheck size={16} />
              <span>I Am Safe Now</span>
            </button>
            {onInspectPacket && (
              <button
                type="button"
                className="view-details-link"
                onClick={() => onInspectPacket(victimActiveSos.id)}
              >
                <span>Technical Packet Details</span>
                <ChevronRight size={14} />
              </button>
            )}
          </div>
        </section>
      )}

      {/* 4. QUICK ACTIONS (Clean, large cards) */}
      <section className="quick-actions-section" aria-label="Quick actions">
        <div className="quick-actions-grid-clean">
          <button
            type="button"
            className="quick-action-card"
            onClick={onNavigateToMap}
          >
            <div className="action-icon-pill icon-purple">
              <Map size={20} />
            </div>
            <div className="action-card-text">
              <strong className="action-title">Find Shelter</strong>
              <span className="action-desc">Offline safe zones & routes</span>
            </div>
          </button>

          <button
            type="button"
            className="quick-action-card"
            onClick={onNavigateToMessages}
          >
            <div className="action-icon-pill icon-blue">
              <MessageSquare size={20} />
            </div>
            <div className="action-card-text">
              <strong className="action-title">Send Message</strong>
              <span className="action-desc">Offline peer-to-peer chat</span>
            </div>
          </button>

          <button
            type="button"
            className="quick-action-card"
            onClick={onNavigateToMesh}
          >
            <div className="action-icon-pill icon-green">
              <Radio size={20} />
            </div>
            <div className="action-card-text">
              <strong className="action-title">Mesh Network</strong>
              <span className="action-desc">Relay nodes & topology</span>
            </div>
          </button>

          <button
            type="button"
            className="quick-action-card"
            onClick={onNavigateToMap}
          >
            <div className="action-icon-pill icon-amber">
              <Compass size={20} />
            </div>
            <div className="action-card-text">
              <strong className="action-title">My Location</strong>
              <span className="action-desc">GPS radar & terrain</span>
            </div>
          </button>
        </div>
      </section>

      {/* 6. SAFE SHELTER (Nearest safe evacuation point) */}
      {nearestShelter && (
        <section className="nearest-shelter-card" aria-label="Nearest safe shelter">
          <div className="shelter-card-top">
            <div className="shelter-header-title">
              <Home size={18} className="shelter-header-icon" />
              <span>Nearest Safe Shelter</span>
            </div>
            <span className="shelter-distance-badge">{nearestShelter.distKm} km away</span>
          </div>

          <div className="shelter-card-content">
            <h3 className="shelter-name">{nearestShelter.name}</h3>
            <p className="shelter-status-text">{nearestShelter.status}</p>
          </div>

          <button
            type="button"
            className="shelter-route-btn"
            onClick={onNavigateToMap}
          >
            <span>VIEW ROUTE ON MAP</span>
            <ChevronRight size={16} />
          </button>
        </section>
      )}

      {/* 7. EMERGENCY INFORMATION (Compact guidelines) */}
      <section className="emergency-tips-card" aria-label="Emergency survival tips">
        <div className="tips-card-header">
          <Info size={16} className="tips-info-icon" />
          <h4 className="tips-title">Emergency Survival Tips</h4>
        </div>
        <ul className="tips-list">
          <li>Move to higher ground immediately if in a flood hazard zone.</li>
          <li>Stay clear of fallen power lines and damaged structures.</li>
          <li>Conserve phone battery; LIFELINE broadcasts in low-power bursts.</li>
          <li>Stay visible and signal responders with flashlights or whistles.</li>
        </ul>
      </section>
    </div>
  );
};
