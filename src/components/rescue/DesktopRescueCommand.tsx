import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { TacticalMap } from '../map/TacticalMap';
import { SosDetailModal } from './SosDetailModal';
import { RedZoneEmergencyModal } from '../common/RedZoneEmergencyModal';
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
  Activity,
  RefreshCw,
  AlertTriangle,
  Wifi,
  Navigation
} from 'lucide-react';

interface Props {
  onSwitchToPhoneView?: () => void;
}

type SortOption = 'CRITICALITY' | 'NEAREST_RESCUE' | 'NEAREST_DISASTER' | 'NEWEST';
type FilterOption = 'ALL' | 'CRITICAL' | 'HIGH' | 'RESCUED';

export const DesktopRescueCommand: React.FC<Props> = ({ onSwitchToPhoneView }) => {
  const {
    sosList,
    meshNodes,
    acknowledgeSos,
    setRespondingSos,
    markRescuedSos,
    syncPending,
    syncWithCloud,
    redZoneSosPopup,
    setRedZoneSosPopup
  } = useApp();

  const [sortOption, setSortOption] = useState<SortOption>('CRITICALITY');
  const [filterOption, setFilterOption] = useState<FilterOption>('ALL');
  const [inspectingPacket, setInspectingPacket] = useState<SosPacket | null>(null);
  const [selectedMapSosId, setSelectedMapSosId] = useState<string | null>(null);

  // Metrics
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

  // Filtered and sorted SOS list
  const displaySosList = useMemo(() => {
    let list = [...sosList];

    if (filterOption === 'CRITICAL') {
      list = list.filter(s => s.priority === 'CRITICAL');
    } else if (filterOption === 'HIGH') {
      list = list.filter(s => s.priority === 'HIGH');
    } else if (filterOption === 'RESCUED') {
      list = list.filter(s => s.status === 'RESCUED');
    }

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
  }, [sosList, sortOption, filterOption]);

  return (
    <div className="desktop-command-root">
      {/* Top Incident Command Header */}
      <header className="desktop-command-header">
        <div className="header-brand-block">
          <div className="hq-tag">
            <Activity size={13} className="animate-pulse" color="#EF4444" />
            <span>INCIDENT COMMAND HQ • SECTOR 4</span>
          </div>
          <h1 className="hq-title">
            <ShieldAlert size={24} color="#EF4444" />
            <span>LIFELINE TACTICAL COMMAND CONSOLE</span>
          </h1>
        </div>

        {/* Live Metrics Row */}
        <div className="desktop-metrics-row">
          <div className="hq-metric-card">
            <span className="hq-metric-val">{metrics.people}</span>
            <span className="hq-metric-lbl">Monitored</span>
          </div>
          <div className="hq-metric-card">
            <span className="hq-metric-val">{metrics.totalSos}</span>
            <span className="hq-metric-lbl">Total SOS</span>
          </div>
          <div className="hq-metric-card critical">
            <span className="hq-metric-val">{metrics.critical}</span>
            <span className="hq-metric-lbl">Critical</span>
          </div>
          <div className="hq-metric-card warning">
            <span className="hq-metric-val">{metrics.warning}</span>
            <span className="hq-metric-lbl">Warning</span>
          </div>
          <div className="hq-metric-card safe">
            <span className="hq-metric-val">{metrics.safe}</span>
            <span className="hq-metric-lbl">Safe / Rescued</span>
          </div>
          <div className="hq-metric-card info">
            <span className="hq-metric-val">{metrics.activeResponders}</span>
            <span className="hq-metric-lbl">Active Units</span>
          </div>
        </div>

        {/* Cloud Sync & Action */}
        <div className="header-actions-block">
          <button
            onClick={syncWithCloud}
            className="hq-sync-btn"
            title="Sync all offline mesh packets with cloud"
          >
            <RefreshCw size={14} className={syncPending ? 'animate-spin' : ''} />
            <span>{syncPending ? 'Syncing...' : 'Sync Gateway'}</span>
          </button>
        </div>
      </header>

      {/* 2-Column Tactical Grid */}
      <div className="desktop-command-grid">
        {/* Left Column: SOS Triage Queue */}
        <div className="desktop-queue-panel">
          <div className="queue-header-bar">
            <div className="queue-title-group">
              <h2 style={{ fontSize: 16, fontWeight: 900, color: '#FFF', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Clock size={16} color="#38BDF8" />
                <span>Live SOS Triage Queue ({displaySosList.length})</span>
              </h2>
            </div>

            {/* Sort Dropdown */}
            <div className="queue-sort-group">
              <ArrowUpDown size={13} color="#94A3B8" />
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as SortOption)}
                className="hq-select"
              >
                <option value="CRITICALITY">Criticality</option>
                <option value="NEAREST_RESCUE">Nearest Rescue</option>
                <option value="NEAREST_DISASTER">Nearest Breach</option>
                <option value="NEWEST">Newest</option>
              </select>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="queue-filter-row">
            <button
              className={`filter-pill ${filterOption === 'ALL' ? 'active' : ''}`}
              onClick={() => setFilterOption('ALL')}
            >
              All ({sosList.length})
            </button>
            <button
              className={`filter-pill critical ${filterOption === 'CRITICAL' ? 'active' : ''}`}
              onClick={() => setFilterOption('CRITICAL')}
            >
              Critical ({sosList.filter(s => s.priority === 'CRITICAL').length})
            </button>
            <button
              className={`filter-pill warning ${filterOption === 'HIGH' ? 'active' : ''}`}
              onClick={() => setFilterOption('HIGH')}
            >
              Warning ({sosList.filter(s => s.priority === 'HIGH').length})
            </button>
            <button
              className={`filter-pill safe ${filterOption === 'RESCUED' ? 'active' : ''}`}
              onClick={() => setFilterOption('RESCUED')}
            >
              Rescued ({sosList.filter(s => s.status === 'RESCUED').length})
            </button>
          </div>

          {/* Scrollable SOS List */}
          <div className="queue-cards-container">
            {displaySosList.length === 0 ? (
              <div className="queue-empty-state">
                <CheckCircle size={36} color="#10B981" />
                <p>No emergency SOS alerts in this filter category.</p>
              </div>
            ) : (
              displaySosList.map((sos) => {
                const isCritical = sos.priority === 'CRITICAL';
                const isHigh = sos.priority === 'HIGH';
                const isRescued = sos.status === 'RESCUED';
                const isResponding = sos.status === 'RESPONDING';
                const isAcknowledged = sos.status === 'ACKNOWLEDGED';

                return (
                  <div
                    key={sos.id}
                    className={`hq-sos-card ${isCritical ? 'critical-border' : isHigh ? 'warning-border' : ''} ${selectedMapSosId === sos.id ? 'highlighted' : ''}`}
                  >
                    {/* Top Card Row */}
                    <div className="hq-card-top">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span
                          className={`hq-priority-tag ${
                            isCritical ? 'critical' : isHigh ? 'warning' : 'safe'
                          }`}
                        >
                          {isCritical ? '🔴 CRITICAL' : isHigh ? '🟡 HIGH' : '🟢 LOW'}
                        </span>
                        <span className="hq-sos-id">{sos.id}</span>
                        <span className="hq-sender-pill">{sos.senderId || sos.userName}</span>
                      </div>

                      <span className={`hq-status-tag ${sos.status.toLowerCase()}`}>
                        {sos.status}
                      </span>
                    </div>

                    {/* Message */}
                    <div className="hq-card-msg">
                      "{sos.message || 'Emergency assistance requested.'}"
                    </div>

                    {/* Telemetry metadata */}
                    <div className="hq-card-telemetry">
                      <span title="Distance from active flood breach">
                        <MapPin size={11} color="#EF4444" />
                        Flood: {sos.distanceFromDisasterKm} km
                      </span>
                      <span title="Distance from rescue base camp">
                        <Truck size={11} color="#38BDF8" />
                        Base: {sos.distanceFromRescueKm} km
                      </span>
                      <span>
                        <Clock size={11} color="#94A3B8" />
                        {sos.timeFormatted || 'Just now'}
                      </span>
                      <span>
                        <Radio size={11} color="#10B981" />
                        Hops: {sos.hopCount ?? 1}
                      </span>
                    </div>

                    {/* Actions Row */}
                    <div className="hq-card-actions">
                      <button
                        className="card-action-btn secondary"
                        onClick={() => setInspectingPacket(sos)}
                      >
                        <Eye size={12} />
                        <span>Telemetry</span>
                      </button>

                      <button
                        className="card-action-btn secondary"
                        onClick={() => setSelectedMapSosId(sos.id)}
                      >
                        <MapPin size={12} />
                        <span>Locate</span>
                      </button>

                      {!isAcknowledged && !isResponding && !isRescued && (
                        <button
                          className="card-action-btn ack"
                          onClick={() => acknowledgeSos(sos.id)}
                        >
                          <CheckCircle size={12} />
                          <span>Acknowledge</span>
                        </button>
                      )}

                      {isAcknowledged && !isResponding && !isRescued && (
                        <button
                          className="card-action-btn respond"
                          onClick={() => setRespondingSos(sos.id)}
                        >
                          <Truck size={12} />
                          <span>Dispatch Boat</span>
                        </button>
                      )}

                      {isResponding && !isRescued && (
                        <button
                          className="card-action-btn rescue"
                          onClick={() => markRescuedSos(sos.id)}
                        >
                          <CheckCircle size={12} />
                          <span>Mark Rescued</span>
                        </button>
                      )}

                      {isRescued && (
                        <span className="card-safe-confirmed">
                          <CheckCircle size={13} color="#10B981" />
                          <span>Safe at Shelter</span>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Full-Height Interactive Tactical Map */}
        <div className="desktop-map-panel">
          <div className="map-panel-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Navigation size={16} color="#38BDF8" />
              <span style={{ fontSize: 13, fontWeight: 800, color: '#FFF' }}>
                TACTICAL GEOSPATIAL MAP (SECTOR 4 FLOOD BASIN)
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#EF4444' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#EF4444' }}></span>
                RED Zone Hazard (1.1 km)
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#10B981' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981' }}></span>
                GREEN Safe Shelters
              </span>
            </div>
          </div>

          <div className="map-panel-body">
            <TacticalMap
              isRescueView={true}
              onSelectSos={(id) => setSelectedMapSosId(id)}
            />
          </div>
        </div>
      </div>

      {/* Telemetry Detail Modal */}
      {inspectingPacket && (
        <SosDetailModal
          packet={inspectingPacket}
          onClose={() => setInspectingPacket(null)}
          onAcknowledge={(id) => {
            acknowledgeSos(id);
            setInspectingPacket(null);
          }}
          onRespond={(id) => {
            setRespondingSos(id);
            setInspectingPacket(null);
          }}
          onMarkRescued={(id) => {
            markRescuedSos(id);
            setInspectingPacket(null);
          }}
        />
      )}

      {/* Emergency Red Area SOS Alert Popup */}
      {redZoneSosPopup && (
        <RedZoneEmergencyModal
          packet={redZoneSosPopup}
          onClose={() => setRedZoneSosPopup(null)}
          onViewOnMap={() => {
            setSelectedMapSosId(redZoneSosPopup.id);
            setRedZoneSosPopup(null);
          }}
          onViewMesh={() => {
            setRedZoneSosPopup(null);
          }}
        />
      )}
    </div>
  );
};
