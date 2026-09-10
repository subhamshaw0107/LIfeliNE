import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { HardwareStatusStrip } from '../common/HardwareStatusStrip';
import { SosDetailModal } from './SosDetailModal';
import { SosPacket } from '../../types';
import {
  ShieldAlert,
  MapPin,
  Clock,
  Eye,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';

interface Props {
  onNavigateToMap: () => void;
  selectedSosIdForDetail?: string | null;
  onClearSelectedDetail?: () => void;
}

export const RescueDashboard: React.FC<Props> = ({
  onNavigateToMap,
  selectedSosIdForDetail,
  onClearSelectedDetail
}) => {
  const {
    sosList,
    acknowledgeSos,
    setRespondingSos,
    markRescuedSos,
    t
  } = useApp();

  const [inspectingPacket, setInspectingPacket] = useState<SosPacket | null>(null);

  React.useEffect(() => {
    if (selectedSosIdForDetail) {
      const p = sosList.find((s) => s.id === selectedSosIdForDetail);
      if (p) setInspectingPacket(p);
    }
  }, [selectedSosIdForDetail, sosList]);

  // Aggregate minimal metrics as requested
  const metrics = useMemo(() => {
    const criticalCount = sosList.filter((s) => s.priority === 'CRITICAL' && s.status !== 'RESCUED').length;
    const pendingCount = sosList.filter((s) => s.status !== 'RESCUED').length;
    const rescuedCount = sosList.filter((s) => s.status === 'RESCUED').length;

    return {
      critical: criticalCount,
      pending: pendingCount,
      rescued: rescuedCount
    };
  }, [sosList]);

  const handleCloseModal = () => {
    setInspectingPacket(null);
    if (onClearSelectedDetail) onClearSelectedDetail();
  };

  return (
    <div className="rescue-container">
      <HardwareStatusStrip />

      {/* Extremely Minimal Summary Metrics (Critical, Pending, Rescued ONLY) */}
      <div className="metrics-summary-grid">
        <div className="metric-card critical">
          <div className="metric-number">{metrics.critical}</div>
          <div className="metric-label">{t('statCritical')}</div>
        </div>

        <div className="metric-card warning">
          <div className="metric-number">{metrics.pending}</div>
          <div className="metric-label">{t('statPending')}</div>
        </div>

        <div className="metric-card safe">
          <div className="metric-number">{metrics.rescued}</div>
          <div className="metric-label">{t('statRescued')}</div>
        </div>
      </div>

      {/* Active Triage List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
        <h3 style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>
          Active Emergency Triage Queue ({sosList.length})
        </h3>

        {sosList.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#64748B', background: '#FFFFFF', borderRadius: 16, border: '1px solid #E2E8F0' }}>
            {t('noAlerts')}
          </div>
        ) : (
          sosList.map((sos) => {
            const isCritical = sos.priority === 'CRITICAL';
            const isHigh = sos.priority === 'HIGH';
            const isRescued = sos.status === 'RESCUED';

            return (
              <div key={sos.id} className="triage-card-item">
                <div className="triage-card-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      className={`priority-badge ${
                        isCritical ? 'critical' : isHigh ? 'high' : 'safe'
                      }`}
                    >
                      {sos.priority}
                    </span>
                    <span style={{ fontSize: 14, fontFamily: 'monospace', fontWeight: 800, color: '#2563EB' }}>
                      {sos.id}
                    </span>
                  </div>

                  <span style={{ fontSize: 12, fontWeight: 700, color: isRescued ? '#16A34A' : '#D97706' }}>
                    {sos.status}
                  </span>
                </div>

                <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>
                  Sender: {sos.senderId || sos.userId}
                </div>

                <div style={{ fontSize: 13, color: '#334155', background: '#F8FAFC', padding: '8px 12px', borderRadius: 10, border: '1px solid #E2E8F0' }}>
                  "{sos.message || 'I need help.'}"
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: '#64748B' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <MapPin size={14} color="#DC2626" />
                    <span>Dist: <strong>{sos.distanceFromDisasterKm} km</strong></span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Clock size={14} />
                    <span>{sos.timeFormatted}</span>
                  </div>
                </div>

                {/* Existing Responder Actions */}
                <div className="action-btn-row">
                  {sos.status !== 'RESCUED' && (
                    <button
                      className="triage-btn primary"
                      onClick={() => setRespondingSos(sos.id)}
                    >
                      <AlertTriangle size={15} />
                      <span>{t('claimBtn')}</span>
                    </button>
                  )}

                  {sos.status !== 'RESCUED' && (
                    <button
                      className="triage-btn secondary"
                      onClick={() => markRescuedSos(sos.id)}
                      style={{ color: '#16A34A' }}
                    >
                      <CheckCircle2 size={15} />
                      <span>{t('markRescuedBtn')}</span>
                    </button>
                  )}

                  <button
                    className="triage-btn secondary"
                    onClick={() => setInspectingPacket(sos)}
                  >
                    <Eye size={15} />
                  </button>

                  <button
                    className="triage-btn secondary"
                    onClick={onNavigateToMap}
                  >
                    <MapPin size={15} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

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
