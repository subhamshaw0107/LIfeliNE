import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { HardwareStatusStrip } from '../common/HardwareStatusStrip';
import { SosDetailModal } from './SosDetailModal';
import { SosPacket } from '../../types';
import {
  ShieldAlert,
  Users,
  Radio,
  MapPin,
  Clock,
  CheckCircle,
  Truck,
  ArrowUpDown,
  Filter,
  Eye,
  Activity
} from 'lucide-react';

interface Props {
  onNavigateToMap: () => void;
  selectedSosIdForDetail?: string | null;
  onClearSelectedDetail?: () => void;
}

type SortOption = 'CRITICALITY' | 'NEAREST_RESCUE' | 'NEAREST_DISASTER' | 'NEWEST';

export const RescueDashboard: React.FC<Props> = ({
  onNavigateToMap,
  selectedSosIdForDetail,
  onClearSelectedDetail
}) => {
  const {
    sosList,
    meshNodes,
    acknowledgeSos,
    setRespondingSos,
    markRescuedSos
  } = useApp();

  const [sortOption, setSortOption] = useState<SortOption>('CRITICALITY');
  const [inspectingPacket, setInspectingPacket] = useState<SosPacket | null>(null);

  // If passed from parent, set inspector
  React.useEffect(() => {
    if (selectedSosIdForDetail) {
      const p = sosList.find(s => s.id === selectedSosIdForDetail);
      if (p) setInspectingPacket(p);
    }
  }, [selectedSosIdForDetail, sosList]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    const totalSos = sosList.length;
    const criticalCount = sosList.filter(s => s.priority === 'CRITICAL' && s.status !== 'RESCUED').length;
    const warningCount = sosList.filter(s => s.priority === 'HIGH' && s.status !== 'RESCUED').length;
    const safeCount = sosList.filter(s => s.status === 'RESCUED' || s.priority === 'LOW' || s.priority === 'MEDIUM').length + 115;
    const activeResponders = 6;
    const meshNodeCount = meshNodes.length;

    return {
      people: 128,
      totalSos,
      critical: criticalCount,
      warning: warningCount,
      safe: safeCount,
      activeResponders,
      meshNodes: meshNodeCount
    };
  }, [sosList, meshNodes]);

  // Sorted SOS list
  const sortedSosList = useMemo(() => {
    const list = [...sosList];
    if (sortOption === 'CRITICALITY') {
      const pMap: Record<string, number> = { CRITICAL: 3, HIGH: 2, MEDIUM: 1, LOW: 0 };
      return list.sort((a, b) => (pMap[b.priority] ?? 0) - (pMap[a.priority] ?? 0) || b.timestamp - a.timestamp);
    }
    if (sortOption === 'NEAREST_RESCUE') {
      return list.sort((a, b) => a.distanceFromRescueKm - b.distanceFromRescueKm);
    }
    if (sortOption === 'NEAREST_DISASTER') {
      return list.sort((a, b) => a.distanceFromDisasterKm - b.distanceFromDisasterKm);
    }
    if (sortOption === 'NEWEST') {
      return list.sort((a, b) => b.timestamp - a.timestamp);
    }
    return list;
  }, [sosList, sortOption]);

  const handleCloseModal = () => {
    setInspectingPacket(null);
    if (onClearSelectedDetail) onClearSelectedDetail();
  };

  return (
    <div className="rescue-container">
      {/* Header */}
      <div className="rescue-header">
        <div>
          <div style={{ fontSize: 10, fontWeight: 800, color: '#38BDF8', letterSpacing: 1.5 }}>
            TACTICAL INCIDENT COMMAND
          </div>
          <h2 className="rescue-header-title">
            <ShieldAlert size={22} color="#EF4444" />
            LIFELINE RESCUE CENTER
          </h2>
        </div>
      </div>

      <HardwareStatusStrip />

      {/* Metrics Grid */}
      <div className="metrics-grid-rescue">
        <div className="metric-box">
          <span className="metric-num">{metrics.people}</span>
          <span className="metric-label">People</span>
        </div>

        <div className="metric-box">
          <span className="metric-num">{metrics.totalSos}</span>
          <span className="metric-label">Total SOS</span>
        </div>

        <div className="metric-box">
          <span className="metric-num critical">🔴 {metrics.critical}</span>
          <span className="metric-label">Critical</span>
        </div>

        <div className="metric-box">
          <span className="metric-num warning">🟡 {metrics.warning}</span>
          <span className="metric-label">Warning</span>
        </div>

        <div className="metric-box">
          <span className="metric-num safe">🟢 {metrics.safe}</span>
          <span className="metric-label">Safe</span>
        </div>

        <div className="metric-box">
          <span className="metric-num" style={{ color: '#38BDF8' }}>
            {metrics.activeResponders}
          </span>
          <span className="metric-label">Responders</span>
        </div>
      </div>

      {/* Nearest Critical Victim Banner */}
      {metrics.critical > 0 && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.12)',
          border: '1px solid rgba(239, 68, 68, 0.35)',
          borderRadius: 12,
          padding: '10px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 12
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Activity size={18} color="#EF4444" />
            <div>
              <div style={{ fontWeight: 800, color: '#FFF' }}>
                PRIORITY: {metrics.critical} CRITICAL RESCUE MISSIONS
              </div>
              <div style={{ fontSize: 10, color: '#FECACA' }}>
                Closest victim is 0.35 km from river breach
              </div>
            </div>
          </div>
          <button
            onClick={() => setSortOption('NEAREST_DISASTER')}
            style={{
              background: '#EF4444',
              color: '#FFF',
              border: 'none',
              padding: '4px 8px',
              borderRadius: 6,
              fontSize: 10,
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Sort Danger
          </button>
        </div>
      )}

      {/* Triage & Sorting Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase' }}>
          Real-time SOS Triage Queue ({sortedSosList.length}):
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <ArrowUpDown size={12} color="#94A3B8" />
          <select
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value as SortOption)}
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid var(--border-card)',
              color: '#FFF',
              borderRadius: 8,
              padding: '4px 6px',
              fontSize: 11,
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="CRITICALITY" style={{ background: '#0F172A' }}>Sort: Criticality</option>
            <option value="NEAREST_RESCUE" style={{ background: '#0F172A' }}>Sort: Nearest to Base</option>
            <option value="NEAREST_DISASTER" style={{ background: '#0F172A' }}>Sort: Closest to Flood</option>
            <option value="NEWEST" style={{ background: '#0F172A' }}>Sort: Newest</option>
          </select>
        </div>
      </div>

      {/* SOS List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {sortedSosList.map((sos) => {
          const isCritical = sos.priority === 'CRITICAL';
          const isHigh = sos.priority === 'HIGH';
          const isLow = sos.priority === 'LOW';
          return (
            <div
              key={sos.id}
              className={`triage-card ${isCritical ? 'critical' : isHigh ? 'warning' : 'safe'}`}
            >
              {/* Header */}
              <div className="triage-card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{
                    fontSize: 11,
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: 6,
                    background: isCritical ? '#EF4444' : isHigh ? '#F59E0B' : '#10B981',
                    color: '#FFF'
                  }}>
                    {isCritical ? '🔴 CRITICAL' : isHigh ? '🟡 HIGH' : '🟢 LOW'}
                  </span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#38BDF8', fontSize: 13 }}>
                    {sos.id}
                  </span>
                </div>

                <span style={{
                  fontSize: 10,
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: 10,
                  background: 'rgba(255,255,255,0.08)',
                  color: sos.status === 'RESCUED' ? '#10B981' : '#FFF'
                }}>
                  {sos.status}
                </span>
              </div>

              {/* Sender ID */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                <span style={{ color: '#94A3B8', fontWeight: 600 }}>Sender:</span>
                <span style={{ fontWeight: 800, color: '#38BDF8', fontFamily: 'monospace', background: 'rgba(56, 189, 248, 0.1)', padding: '2px 6px', borderRadius: 4 }}>
                  {sos.senderId || sos.userId || 'PERSON-A'}
                </span>
              </div>

              {/* Message */}
              <div style={{ fontSize: 12, color: '#E2E8F0', fontStyle: 'italic', background: 'rgba(0,0,0,0.25)', padding: '6px 8px', borderRadius: 6 }}>
                "{sos.message}"
              </div>

              {/* Details Grid */}
              <div className="triage-grid-details">
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#94A3B8' }}>
                  <MapPin size={12} color="#EF4444" />
                  <span>Flood: <strong>{sos.distanceFromDisasterKm} km</strong></span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#94A3B8' }}>
                  <Truck size={12} color="#0284C7" />
                  <span>Base: <strong>{sos.distanceFromRescueKm} km</strong></span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#94A3B8' }}>
                  <Radio size={12} color="#10B981" />
                  <span>Device: <strong style={{ fontFamily: 'monospace' }}>{sos.deviceId}</strong></span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#94A3B8' }}>
                  <Clock size={12} color="#94A3B8" />
                  <span>Time: <strong>{sos.timeFormatted}</strong></span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="triage-actions-row">
                <button
                  className="triage-btn inspect"
                  onClick={() => setInspectingPacket(sos)}
                  title="View full technical telemetry and cryptographic keys"
                >
                  <Eye size={12} />
                  [DETAILS]
                </button>

                <button
                  className="triage-btn inspect"
                  onClick={onNavigateToMap}
                  title="View victim pin on map"
                >
                  <MapPin size={12} />
                  [VIEW MAP]
                </button>

                {sos.status !== 'ACKNOWLEDGED' && sos.status !== 'RESPONDING' && sos.status !== 'RESCUED' && (
                  <button
                    className="triage-btn ack"
                    onClick={() => acknowledgeSos(sos.id)}
                  >
                    [ACKNOWLEDGE]
                  </button>
                )}

                {sos.status !== 'RESPONDING' && sos.status !== 'RESCUED' && (
                  <button
                    className="triage-btn respond"
                    onClick={() => setRespondingSos(sos.id)}
                  >
                    [RESPONDING]
                  </button>
                )}

                {sos.status !== 'RESCUED' && (
                  <button
                    className="triage-btn rescued"
                    onClick={() => markRescuedSos(sos.id)}
                  >
                    [MARK RESCUED]
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Inspector if open */}
      {inspectingPacket && (
        <SosDetailModal
          packet={inspectingPacket}
          onClose={handleCloseModal}
          onAcknowledge={acknowledgeSos}
          onRespond={setRespondingSos}
          onMarkRescued={markRescuedSos}
        />
      )}
    </div>
  );
};
