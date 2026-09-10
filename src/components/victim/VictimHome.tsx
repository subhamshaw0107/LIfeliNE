import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { HardwareStatusStrip } from '../common/HardwareStatusStrip';
import { SosTrackerCard } from '../common/SosTrackerCard';
import { geoService, SAFE_SHELTERS, haversineDistanceKm } from '../../services/geoService';
import {
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  HeartPulse,
  Users,
  Flame,
  Home,
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
    markSafe,
    sendQuickMessage,
    isNative,
    isGpsReal,
    t
  } = useApp();

  const [isSending, setIsSending] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0); // 0 to 100%
  const [isHolding, setIsHolding] = useState(false);
  const [tapHint, setTapHint] = useState<string | null>(null);
  const [activationState, setActivationState] = useState<'IDLE' | 'COUNTDOWN' | 'TRIGGERED'>('IDLE');

  const [sosSentCount, setSosSentCount] = useState<number>(() => {
    const saved = localStorage.getItem('lifeline_sos_sent_count');
    return saved ? parseInt(saved, 10) : 0;
  });

  useEffect(() => {
    if (victimActiveSos && sosSentCount === 0) {
      setSosSentCount(1);
      localStorage.setItem('lifeline_sos_sent_count', '1');
    }
  }, [victimActiveSos, sosSentCount]);

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
  const triggerSosActivation = async (customText?: string) => {
    if (isSending) return;
    if (sosSentCount >= 2) {
      setTapHint('Maximum 2 SOS broadcasts reached (0 remaining).');
      setTimeout(() => setTapHint(null), 3000);
      return;
    }

    setIsSending(true);
    setActivationState('TRIGGERED');

    const nextCount = Math.min(2, sosSentCount + 1);
    setSosSentCount(nextCount);
    localStorage.setItem('lifeline_sos_sent_count', nextCount.toString());

    // Haptic buzz on mobile devices if supported
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([150, 80, 250]);
      } catch {
        // ignore if not supported
      }
    }

    try {
      if (customText) {
        await sendQuickMessage(customText);
      } else {
        await sendSos();
      }
    } finally {
      setIsSending(false);
      setHoldProgress(0);
      setIsHolding(false);
      setActivationState('IDLE');
    }
  };

  // Press-and-hold handlers for SOS button (1 second required)
  const startHold = (e: React.MouseEvent | React.TouchEvent) => {
    if (victimActiveSos && sosSentCount >= 2) {
      setTapHint('Maximum 2 SOS limit reached (0 remaining). Emergency beacon active.');
      setTimeout(() => setTapHint(null), 3000);
      return;
    }

    if (sosSentCount >= 2) {
      setTapHint('Maximum 2 SOS broadcasts reached (0 remaining).');
      setTimeout(() => setTapHint(null), 3000);
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
      const progress = Math.min(100, (elapsed / 1000) * 100);
      setHoldProgress(progress);

      if (progress < 100) {
        animationFrameRef.current = requestAnimationFrame(updateLoop);
      } else {
        // 1 second complete! Trigger SOS
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
    if (elapsed > 80 && elapsed < 900 && !victimActiveSos) {
      setTapHint('Press and hold for 1 full second to trigger emergency SOS');
      setTimeout(() => setTapHint(null), 3000);
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

  const handleCategoryClick = async (categoryText: string) => {
    if (isSending) return;
    if (sosSentCount >= 2) {
      setTapHint('Maximum 2 SOS broadcasts reached.');
      setTimeout(() => setTapHint(null), 3000);
      return;
    }
    await triggerSosActivation(categoryText);
  };

  const isResponderAssigned = useMemo(() => {
    if (!victimActiveSos) return false;
    return ['RESPONDING', 'RESCUED'].includes(victimActiveSos.status);
  }, [victimActiveSos]);

  return (
    <div className="victim-home-container" style={{ padding: '14px 16px 20px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* 1. Hardware Status Strip */}
      <HardwareStatusStrip />

      {/* 2. Safety Status Banner */}
      <section
        style={{
          background: riskEval.riskLevel === 'CRITICAL' ? '#FEF2F2' : riskEval.riskLevel === 'WARNING' ? '#FFFBEB' : '#F0FDF4',
          border: `1.5px solid ${riskEval.riskLevel === 'CRITICAL' ? '#FECACA' : riskEval.riskLevel === 'WARNING' ? '#FDE68A' : '#BBF7D0'}`,
          borderRadius: 14,
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10
        }}
        aria-label="Safety status"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            color: riskEval.riskLevel === 'CRITICAL' ? '#DC2626' : riskEval.riskLevel === 'WARNING' ? '#D97706' : '#16A34A',
            display: 'flex',
            alignItems: 'center'
          }}>
            {riskEval.riskLevel === 'SAFE' ? <ShieldCheck size={26} /> : <AlertTriangle size={26} />}
          </div>
          <div>
            <h2 style={{
              fontSize: 14,
              fontWeight: 900,
              color: riskEval.riskLevel === 'CRITICAL' ? '#DC2626' : riskEval.riskLevel === 'WARNING' ? '#B45309' : '#15803D',
              margin: 0
            }}>
              {riskEval.riskLevel === 'CRITICAL' && 'YOU ARE IN DANGER'}
              {riskEval.riskLevel === 'WARNING' && 'WARNING: NEAR HAZARD'}
              {riskEval.riskLevel === 'SAFE' && 'YOU ARE IN A SAFE AREA'}
            </h2>
            <p style={{ fontSize: 12, color: '#475569', margin: '2px 0 0 0', fontWeight: 500 }}>
              {riskEval.riskLevel === 'CRITICAL' &&
                (riskEval.distanceKm <= 0.1
                  ? `${riskEval.closestZone.name} • Inside Hazard Zone`
                  : `${riskEval.closestZone.name} • ${riskEval.distanceKm} km away`)}
              {riskEval.riskLevel === 'WARNING' &&
                `Near ${riskEval.closestZone.name} • ${riskEval.distanceKm} km away`}
              {riskEval.riskLevel === 'SAFE' && 'No active disaster hazard in your immediate vicinity'}
            </p>
          </div>
        </div>

        {/* Zone Simulator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingTop: 4, borderTop: '1px solid rgba(0,0,0,0.06)' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#64748B' }}>Simulate Zone:</span>
          <button
            type="button"
            style={{
              padding: '2px 8px',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              border: '1px solid #FECACA',
              background: riskEval.riskLevel === 'CRITICAL' ? '#FEE2E2' : '#FFFFFF',
              color: '#DC2626'
            }}
            onClick={() => updateLocation({ latitude: 22.978, longitude: 88.438 })}
          >
            🔴 Red
          </button>
          <button
            type="button"
            style={{
              padding: '2px 8px',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              border: '1px solid #FDE68A',
              background: riskEval.riskLevel === 'WARNING' ? '#FEF3C7' : '#FFFFFF',
              color: '#D97706'
            }}
            onClick={() => updateLocation({ latitude: 22.966, longitude: 88.432 })}
          >
            🟡 Yellow
          </button>
          <button
            type="button"
            style={{
              padding: '2px 8px',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              border: '1px solid #BBF7D0',
              background: riskEval.riskLevel === 'SAFE' ? '#DCFCE7' : '#FFFFFF',
              color: '#16A34A'
            }}
            onClick={() => updateLocation({ latitude: 22.945, longitude: 88.4 })}
          >
            🟢 Green
          </button>
        </div>
      </section>

      {/* 3. Primary SOS Action Button (Clean Light 1-Second Press-and-Hold) */}
      <section style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '8px 0' }} aria-label="Emergency SOS activation">
        <div style={{ position: 'relative', width: 210, height: 210, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {/* Circular SVG Progress Ring for Hold */}
          <svg
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: 210,
              height: 210,
              transform: 'rotate(-90deg)',
              pointerEvents: 'none',
              zIndex: 6
            }}
            viewBox="0 0 220 220"
          >
            <circle cx="110" cy="110" r="100" fill="none" stroke="#FEE2E2" strokeWidth="6px" />
            <circle
              cx="110"
              cy="110"
              r="100"
              fill="none"
              stroke="#DC2626"
              strokeWidth="6px"
              strokeLinecap="round"
              style={{
                strokeDasharray: 628,
                strokeDashoffset: 628 - (628 * holdProgress) / 100,
                transition: 'stroke-dashoffset 0.04s linear'
              }}
            />
          </svg>

          <button
            type="button"
            onMouseDown={startHold}
            onMouseUp={cancelHold}
            onMouseLeave={cancelHold}
            onTouchStart={startHold}
            onTouchEnd={cancelHold}
            onTouchCancel={cancelHold}
            disabled={isSending || sosSentCount >= 2}
            style={{
              width: 180,
              height: 180,
              borderRadius: '50%',
              background: victimActiveSos ? '#991B1B' : '#DC2626',
              border: '6px solid #FEE2E2',
              color: '#FFFFFF',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              cursor: 'pointer',
              boxShadow: isHolding
                ? '0 0 30px rgba(220, 38, 38, 0.6)'
                : '0 8px 24px rgba(220, 38, 38, 0.25)',
              transform: isHolding ? 'scale(0.96)' : 'scale(1)',
              transition: 'all 0.15s ease',
              zIndex: 5,
              userSelect: 'none'
            }}
            aria-label={t('sosButtonLabel')}
          >
            <AlertTriangle size={42} color="#FFFFFF" />
            <span style={{ fontSize: 20, fontWeight: 900, letterSpacing: '0.5px' }}>
              {isSending ? 'SENDING...' : t('sosButtonLabel')}
            </span>
            <span style={{ fontSize: 11, fontWeight: 600, opacity: 0.9 }}>
              {victimActiveSos ? 'BEACON ACTIVE' : isHolding ? `${Math.round(holdProgress)}%` : t('sosButtonSubtext')}
            </span>
          </button>
        </div>

        <p style={{ fontSize: 12, color: '#64748B', fontWeight: 600, margin: 0 }}>
          {victimActiveSos
            ? '🚨 Emergency Beacon Active — Relaying to Rescuers'
            : isHolding
            ? 'Keep holding to broadcast emergency SOS...'
            : 'Press and hold for 1 second'}
        </p>

        {/* Quota Indicator */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 12px',
            borderRadius: 14,
            fontSize: 11,
            fontWeight: 700,
            background: sosSentCount === 0 ? '#EFF6FF' : sosSentCount === 1 ? '#FFFBEB' : '#FEF2F2',
            border: `1px solid ${sosSentCount === 0 ? '#BFDBFE' : sosSentCount === 1 ? '#FDE68A' : '#FECACA'}`,
            color: sosSentCount === 0 ? '#2563EB' : sosSentCount === 1 ? '#D97706' : '#DC2626'
          }}
        >
          {sosSentCount === 0 && <span>⚡ 2 broadcasts maximum • 0 used (2 remaining)</span>}
          {sosSentCount === 1 && <span>⚠️ 2 broadcasts maximum • 1 used (1 remaining)</span>}
          {sosSentCount >= 2 && <span>⛔ 2 broadcasts maximum • Limit reached</span>}
        </div>

        {/* Cooldown or Tap Hint */}
        {tapHint && (
          <div style={{
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: 8,
            padding: '6px 12px',
            color: '#DC2626',
            fontSize: 12,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}>
            <Info size={14} />
            <span>{tapHint}</span>
          </div>
        )}
      </section>

      {/* 4. Active SOS Status Tracker */}
      {victimActiveSos && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <SosTrackerCard onInspect={() => onInspectPacket && onInspectPacket(victimActiveSos.id)} />

          {/* Responder Assigned Banner */}
          {isResponderAssigned && (
            <div style={{
              background: '#EFF6FF',
              border: '1.5px solid #93C5FD',
              borderRadius: 12,
              padding: '12px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 12
            }}>
              <Ambulance size={24} color="#2563EB" />
              <div>
                <strong style={{ fontSize: 13, color: '#1D4ED8', display: 'block' }}>Responder Assigned</strong>
                <p style={{ fontSize: 12, color: '#1E40AF', margin: '2px 0 0 0' }}>Rescue squad is en route to your GPS position.</p>
              </div>
            </div>
          )}

          {/* Mark Safe Button */}
          <button
            type="button"
            onClick={handleMarkSafe}
            disabled={isSending}
            style={{
              height: 48,
              background: '#16A34A',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: 12,
              fontSize: 15,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              boxShadow: '0 4px 12px rgba(22, 163, 74, 0.25)'
            }}
          >
            <CheckCircle2 size={18} />
            <span>{t('markSafeBtn')}</span>
          </button>
        </div>
      )}

      {/* 5. 4 Quick Category Emergency Buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h3 style={{ fontSize: 14, fontWeight: 800, color: '#0F172A', margin: 0 }}>
          {t('quickCategoriesTitle')}
        </h3>

        <div className="quick-category-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <button
            className="category-card-btn"
            onClick={() => handleCategoryClick(t('catMedical'))}
            disabled={isSending}
          >
            <div className="category-icon-box" style={{ background: '#FEF2F2', color: '#DC2626' }}>
              <HeartPulse size={22} />
            </div>
            <span className="category-card-title">{t('catMedical')}</span>
          </button>

          <button
            className="category-card-btn"
            onClick={() => handleCategoryClick(t('catTrapped'))}
            disabled={isSending}
          >
            <div className="category-icon-box" style={{ background: '#FFFBEB', color: '#D97706' }}>
              <Users size={22} />
            </div>
            <span className="category-card-title">{t('catTrapped')}</span>
          </button>

          <button
            className="category-card-btn"
            onClick={() => handleCategoryClick(t('catHazard'))}
            disabled={isSending}
          >
            <div className="category-icon-box" style={{ background: '#FEF2F2', color: '#DC2626' }}>
              <Flame size={22} />
            </div>
            <span className="category-card-title">{t('catHazard')}</span>
          </button>

          <button
            className="category-card-btn"
            onClick={handleMarkSafe}
            disabled={isSending}
          >
            <div className="category-icon-box" style={{ background: '#F0FDF4', color: '#16A34A' }}>
              <CheckCircle2 size={22} />
            </div>
            <span className="category-card-title">{t('catSafe')}</span>
          </button>
        </div>
      </div>

      {/* 6. Nearest Safe Shelter */}
      {nearestShelter && (
        <section
          style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: 14,
            padding: '14px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
          }}
          aria-label="Nearest safe shelter"
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Home size={18} color="#2563EB" />
              <span style={{ fontSize: 13, fontWeight: 800, color: '#0F172A' }}>Nearest Safe Shelter</span>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#2563EB', background: '#EFF6FF', padding: '2px 8px', borderRadius: 8 }}>
              {nearestShelter.distKm} km away
            </span>
          </div>

          <div>
            <h4 style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', margin: '0 0 2px 0' }}>{nearestShelter.name}</h4>
            <p style={{ fontSize: 12, color: '#64748B', margin: 0 }}>{nearestShelter.status}</p>
          </div>

          <button
            type="button"
            onClick={onNavigateToMap}
            style={{
              height: 40,
              background: '#F1F5F9',
              border: '1px solid #CBD5E1',
              borderRadius: 10,
              color: '#0F172A',
              fontWeight: 700,
              fontSize: 12,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6
            }}
          >
            <span>VIEW ROUTE ON MAP</span>
            <ChevronRight size={15} />
          </button>
        </section>
      )}

      {/* 7. Emergency Survival Tips */}
      <section
        style={{
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: 14,
          padding: '14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
        }}
        aria-label="Emergency survival tips"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Info size={16} color="#2563EB" />
          <h4 style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', margin: 0 }}>Emergency Survival Tips</h4>
        </div>
        <ul style={{ paddingLeft: 18, margin: 0, fontSize: 12, color: '#475569', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <li>Move to higher ground immediately if in a flood hazard zone.</li>
          <li>Stay clear of fallen power lines and damaged structures.</li>
          <li>Conserve phone battery; LIFELINE broadcasts in low-power bursts.</li>
          <li>Stay visible and signal responders with flashlights or whistles.</li>
        </ul>
      </section>
    </div>
  );
};
