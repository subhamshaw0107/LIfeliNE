import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { RESCUE_HEADQUARTERS, SAFE_SHELTERS } from '../../services/geoService';
import { HardwareStatusStrip } from '../common/HardwareStatusStrip';
import { Navigation, AlertTriangle, ShieldCheck, WifiOff, Globe, Layers, CheckCircle2 } from 'lucide-react';
import L from 'leaflet';
import {
  KALYANI_STATION_COORDS,
  JIS_COLLEGE_COORDS,
  KALYANI_CORRIDOR_BOUNDS,
  KALYANI_ROAD_CORRIDOR
} from '../../data/kalyaniDemoCorridor';

import KalyaniMap from '../KalyaniMap';

interface Props {
  isRescueView?: boolean;
  onSelectSos?: (sosId: string) => void;
}

// Tactical Dark Theme for Google Maps
const GOOGLE_MAPS_DARK_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#171F2F' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#171F2F' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#94A3B8' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#E2E8F0' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#38BDF8' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#112920' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#27354A' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#1E293B' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#CBD5E1' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3B4E68' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#1E293B' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0B1120' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#64748B' }] }
];

export const TacticalMap: React.FC<Props> = ({ isRescueView = false, onSelectSos }) => {
  const {
    location,
    disasterZones,
    sosList,
    victimActiveSos,
    setRedZoneSosPopup
  } = useApp();

  const googleMapDivRef = useRef<HTMLDivElement | null>(null);
  const leafletMapDivRef = useRef<HTMLDivElement | null>(null);

  const [mapEngine, setMapEngine] = useState<'GOOGLE' | 'LEAFLET'>('LEAFLET');
  const [googleMapsLoaded, setGoogleMapsLoaded] = useState<boolean>(false);
  const [googleMapsAuthFailed, setGoogleMapsAuthFailed] = useState<boolean>(false);
  const [googleMapType, setGoogleMapType] = useState<'roadmap' | 'satellite'>('roadmap');

  // Map instance references
  const googleMapInstanceRef = useRef<any>(null);
  const googleOverlaysRef = useRef<any[]>([]);
  const leafletMapInstanceRef = useRef<L.Map | null>(null);
  const leafletMarkersRef = useRef<L.LayerGroup | null>(null);

  const [simulateOfflineMapTiles, setSimulateOfflineMapTiles] = useState(false);
  const [activeRedAlertBanner, setActiveRedAlertBanner] = useState<any | null>(null);

  // Non-intrusive engine-fallback notice (auto-dismissed, no layout shift).
  const [mapNotice, setMapNotice] = useState<string | null>(null);
  const noticeTimerRef = useRef<number | null>(null);
  const showMapNotice = (msg: string) => {
    setMapNotice(msg);
    if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = window.setTimeout(() => setMapNotice(null), 5000);
  };
  useEffect(() => () => {
    if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
  }, []);

  // Catch Google Maps Authentication Failure (e.g. key domain restrictions, billing, etc.)
  useEffect(() => {
    (window as any).gm_authFailure = () => {
      console.warn("Google Maps API auth check failed - falling back to Offline Tactical Vector Map.");
      setGoogleMapsAuthFailed(true);
      setMapEngine('LEAFLET');
      showMapNotice('Google Maps API unavailable. Switched to Tactical Offline Map.');
    };
    // Script load failure (network/offline/blocked): same fallback path.
    const onScriptError = () => {
      console.warn("Google Maps script failed to load - falling back to Offline Tactical Vector Map.");
      setGoogleMapsAuthFailed(true);
      setMapEngine('LEAFLET');
      showMapNotice('Google Maps API unavailable. Switched to Tactical Offline Map.');
    };
    window.addEventListener('gm_script_error', onScriptError);
    if ((window as any).__gmScriptError) onScriptError();
    return () => window.removeEventListener('gm_script_error', onScriptError);
  }, []);

  // Check if Google Maps is available in window
  useEffect(() => {
    let checkCount = 0;
    const checkGoogleMaps = () => {
      if ((window as any).google && (window as any).google.maps) {
        setGoogleMapsLoaded(true);
      } else if (checkCount < 10) {
        checkCount++;
        setTimeout(checkGoogleMaps, 250);
      } else {
        // Default to Leaflet after 2.5s timeout
        setMapEngine('LEAFLET');
      }
    };
    checkGoogleMaps();
  }, []);

  // Detect if victim or any person in RED area gave SOS -> Trigger banner
  useEffect(() => {
    const redSos = victimActiveSos && victimActiveSos.riskLevel === 'CRITICAL'
      ? victimActiveSos
      : sosList.find(s => s.priority === 'CRITICAL' && s.riskLevel === 'CRITICAL');

    if (redSos) {
      setActiveRedAlertBanner(redSos);
    }
  }, [victimActiveSos, sosList]);

  // ==========================================
  // 1. LIVE GOOGLE MAP INITIALIZATION
  // ==========================================
  useEffect(() => {
    if (mapEngine !== 'GOOGLE' || !googleMapsLoaded || !googleMapDivRef.current || simulateOfflineMapTiles) return;

    try {
      const gmaps = (window as any).google?.maps;
      if (!gmaps) {
        console.warn("Google Maps API object missing - falling back to Offline Tactical Vector Map.");
        setGoogleMapsAuthFailed(true);
        setMapEngine('LEAFLET');
        showMapNotice('Google Maps API unavailable. Switched to Tactical Offline Map.');
        return;
      }
      const centerLatLng = { lat: 22.9785, lng: 88.4395 };

      if (!googleMapInstanceRef.current) {
        const gmap = new gmaps.Map(googleMapDivRef.current, {
          center: centerLatLng,
          zoom: 14,
          mapTypeId: googleMapType,
          styles: googleMapType === 'roadmap' ? GOOGLE_MAPS_DARK_STYLE : undefined,
          disableDefaultUI: true,
          zoomControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false
        });
        googleMapInstanceRef.current = gmap;
      }

      const gmap = googleMapInstanceRef.current;
      gmap.setMapTypeId(googleMapType);
      if (googleMapType === 'roadmap') {
        gmap.setOptions({ styles: GOOGLE_MAPS_DARK_STYLE });
      } else {
        gmap.setOptions({ styles: null });
      }

      // Clear previous overlays
      googleOverlaysRef.current.forEach(o => o.setMap && o.setMap(null));
      googleOverlaysRef.current = [];

      // --- MARK RED AREAS (Flood Hazard Core) ---
      disasterZones.forEach(zone => {
        const redCircle = new gmaps.Circle({
          strokeColor: '#EF4444',
          strokeOpacity: 0.95,
          strokeWeight: 2.5,
          fillColor: '#EF4444',
          fillOpacity: 0.28,
          map: gmap,
          center: { lat: zone.latitude, lng: zone.longitude },
          radius: zone.radiusKm * 1000
        });
        googleOverlaysRef.current.push(redCircle);

        const warningCircle = new gmaps.Circle({
          strokeColor: '#F59E0B',
          strokeOpacity: 0.7,
          strokeWeight: 1.5,
          fillColor: '#F59E0B',
          fillOpacity: 0.08,
          map: gmap,
          center: { lat: zone.latitude, lng: zone.longitude },
          radius: (zone.radiusKm + 1.2) * 1000
        });
        googleOverlaysRef.current.push(warningCircle);

        const redMarker = new gmaps.Marker({
          position: { lat: zone.latitude, lng: zone.longitude },
          map: gmap,
          title: `🔴 RED AREA: ${zone.name}`,
          label: {
            text: '🔴 RED AREA',
            color: '#FFFFFF',
            fontSize: '11px',
            fontWeight: '800'
          },
          icon: {
            path: gmaps.SymbolPath?.CIRCLE || 0,
            scale: 12,
            fillColor: '#EF4444',
            fillOpacity: 1,
            strokeColor: '#FFFFFF',
            strokeWeight: 2
          }
        });
        googleOverlaysRef.current.push(redMarker);

        const redInfoWindow = new gmaps.InfoWindow({
          content: `
            <div style="color:#0F172A; font-family:sans-serif; padding:6px; max-width:240px;">
              <div style="background:#EF4444; color:#FFF; font-size:10px; font-weight:800; padding:2px 6px; border-radius:4px; display:inline-block;">
                🔴 RED HAZARD AREA
              </div>
              <h4 style="margin:4px 0 2px; font-size:13px; color:#EF4444;">${zone.name}</h4>
              <p style="margin:0; font-size:11px; color:#475569;">${zone.description}</p>
              <p style="margin:4px 0 0; font-size:10px; font-weight:700; color:#EF4444;">
                Priority: CRITICAL EMERGENCY
              </p>
            </div>
          `
        });
        redMarker.addListener('click', () => redInfoWindow.open(gmap, redMarker));
      });

      // --- MARK GREEN AREAS (Safe Relief Shelters) ---
      SAFE_SHELTERS.forEach(shelter => {
        const greenCircle = new gmaps.Circle({
          strokeColor: '#10B981',
          strokeOpacity: 0.95,
          strokeWeight: 2.5,
          fillColor: '#10B981',
          fillOpacity: 0.25,
          map: gmap,
          center: { lat: shelter.latitude, lng: shelter.longitude },
          radius: 500
        });
        googleOverlaysRef.current.push(greenCircle);

        const shelterMarker = new gmaps.Marker({
          position: { lat: shelter.latitude, lng: shelter.longitude },
          map: gmap,
          title: `🟢 GREEN AREA: ${shelter.name}`,
          label: {
            text: '🟢 GREEN AREA',
            color: '#FFFFFF',
            fontSize: '11px',
            fontWeight: '800'
          },
          icon: {
            path: gmaps.SymbolPath?.CIRCLE || 0,
            scale: 12,
            fillColor: '#10B981',
            fillOpacity: 1,
            strokeColor: '#FFFFFF',
            strokeWeight: 2
          }
        });
        googleOverlaysRef.current.push(shelterMarker);

        const shelterInfo = new gmaps.InfoWindow({
          content: `
            <div style="color:#0F172A; font-family:sans-serif; padding:6px; max-width:240px;">
              <div style="background:#10B981; color:#FFF; font-size:10px; font-weight:800; padding:2px 6px; border-radius:4px; display:inline-block;">
                🟢 GREEN SAFE SHELTER
              </div>
              <h4 style="margin:4px 0 2px; font-size:13px; color:#10B981;">${shelter.name}</h4>
              <p style="margin:0; font-size:11px; color:#475569;">Capacity: ${shelter.capacity} people | Supplies Available</p>
            </div>
          `
        });
        shelterMarker.addListener('click', () => shelterInfo.open(gmap, shelterMarker));
      });

      // --- RESCUE HQ ---
      const hqMarker = new gmaps.Marker({
        position: { lat: RESCUE_HEADQUARTERS.latitude, lng: RESCUE_HEADQUARTERS.longitude },
        map: gmap,
        title: '🛡️ RESCUE HEADQUARTERS',
        label: {
          text: '🛡️ HQ',
          color: '#FFFFFF',
          fontSize: '10px',
          fontWeight: '900'
        },
        icon: {
          path: gmaps.SymbolPath?.CIRCLE || 0,
          scale: 13,
          fillColor: '#F59E0B',
          fillOpacity: 1,
          strokeColor: '#FFFFFF',
          strokeWeight: 2.5
        }
      });
      googleOverlaysRef.current.push(hqMarker);

      // --- VICTIM LOCATION PIN ---
      const victimMarker = new gmaps.Marker({
        position: { lat: location.latitude, lng: location.longitude },
        map: gmap,
        title: '📍 YOUR POSITION',
        label: {
          text: '📍 YOU',
          color: '#FFFFFF',
          fontSize: '10px',
          fontWeight: '900'
        },
        icon: {
          path: gmaps.SymbolPath?.CIRCLE || 0,
          scale: 12,
          fillColor: '#38BDF8',
          fillOpacity: 1,
          strokeColor: '#FFFFFF',
          strokeWeight: 3
        }
      });
      googleOverlaysRef.current.push(victimMarker);

      // --- RED AREA ACTIVE SOS POPUP ---
      if (activeRedAlertBanner) {
        const sosPopup = new gmaps.InfoWindow({
          position: { lat: activeRedAlertBanner.latitude, lng: activeRedAlertBanner.longitude },
          content: `
            <div style="color:#0F172A; font-family:sans-serif; padding:8px; max-width:240px;">
              <div style="background:#EF4444; color:#FFF; font-size:10px; font-weight:900; padding:2px 8px; border-radius:4px; display:inline-block;">
                🚨 RED AREA SOS POPUP
              </div>
              <h3 style="margin:6px 0 2px; font-size:14px; font-weight:800; color:#EF4444;">${activeRedAlertBanner.id}</h3>
              <p style="margin:0; font-size:11px;"><strong>Sender:</strong> ${activeRedAlertBanner.senderId || 'PERSON-A'}</p>
              <p style="margin:2px 0 0; font-size:11px;"><strong>Priority:</strong> <span style="color:#EF4444; font-weight:800;">CRITICAL</span></p>
              <p style="margin:2px 0 0; font-size:11px; font-style:italic;">"${activeRedAlertBanner.message}"</p>
            </div>
          `
        });
        sosPopup.open(gmap);
        googleOverlaysRef.current.push(sosPopup);
      }

      // Trigger resize after DOM setup
      setTimeout(() => {
        if (gmaps?.event && googleMapInstanceRef.current) {
          gmaps.event.trigger(googleMapInstanceRef.current, 'resize');
        }
      }, 150);

    } catch (err) {
      console.warn("Google Maps error, auto-falling back to Leaflet:", err);
      setMapEngine('LEAFLET');
      showMapNotice('Google Maps API unavailable. Switched to Tactical Offline Map.');
    }
  }, [
    mapEngine,
    googleMapsLoaded,
    googleMapType,
    simulateOfflineMapTiles,
    location,
    disasterZones,
    sosList,
    activeRedAlertBanner
  ]);

  return (
    <div className="map-screen-wrapper">
      {/* 1. Google Maps Container */}
      <div
        ref={googleMapDivRef}
        className="google-map-container"
        style={{
          display: mapEngine === 'GOOGLE' && !simulateOfflineMapTiles ? 'block' : 'none'
        }}
      />

      {/* 2. Kalyani Interactive Map Component */}
      <div
        className="leaflet-map-container"
        style={{
          display: mapEngine === 'LEAFLET' && !simulateOfflineMapTiles ? 'block' : 'none',
          position: 'relative',
          width: '100%',
          height: '100%'
        }}
      >
        <KalyaniMap isRescueView={isRescueView} onSelectSos={onSelectSos} />
      </div>

      {/* 3. Top Floating Telemetry & Controls */}
      <div
        style={{
          position: 'absolute',
          top: 8,
          left: 10,
          right: 10,
          zIndex: 400,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          pointerEvents: 'auto'
        }}
      >
        <HardwareStatusStrip />

        {/* Engine-fallback toast (fixed overlay: no layout shift) */}
        {mapNotice && (
          <div style={{
            position: 'fixed',
            bottom: 76,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            background: 'rgba(15, 23, 42, 0.96)',
            border: '1px solid rgba(245, 158, 11, 0.5)',
            color: '#FDE68A',
            fontSize: 11,
            fontWeight: 700,
            padding: '8px 14px',
            borderRadius: 10,
            boxShadow: '0 4px 18px rgba(0,0,0,0.5)',
            maxWidth: '92vw',
            textAlign: 'center'
          }}>
            {mapNotice}
          </div>
        )}

        {/* GPS Live Telemetry Pill & Engine Selector */}
        <div
          style={{
            background: 'rgba(15, 23, 42, 0.94)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            borderRadius: 10,
            padding: '6px 10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 11
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Navigation size={13} color="#10B981" />
            <span style={{ fontWeight: 800, color: '#FFF' }}>
              {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* Engine Toggle */}
            <button
              onClick={() => {
                const nextEngine = mapEngine === 'GOOGLE' ? 'LEAFLET' : 'GOOGLE';
                setMapEngine(nextEngine);
              }}
              style={{
                background: mapEngine === 'GOOGLE' ? 'rgba(56, 189, 248, 0.25)' : 'rgba(16, 185, 129, 0.25)',
                border: `1px solid ${mapEngine === 'GOOGLE' ? '#38BDF8' : '#10B981'}`,
                color: mapEngine === 'GOOGLE' ? '#38BDF8' : '#10B981',
                padding: '3px 8px',
                borderRadius: 6,
                fontWeight: 800,
                fontSize: 10,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4
              }}
              title="Switch between Google Maps and Offline Tactical Map"
            >
              <Globe size={11} />
              <span>{mapEngine === 'GOOGLE' ? '🗺️ Google Maps' : '🛰️ Offline Map'}</span>
            </button>

            {mapEngine === 'GOOGLE' && (
              <button
                onClick={() => setGoogleMapType(googleMapType === 'roadmap' ? 'satellite' : 'roadmap')}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.25)',
                  color: '#FFF',
                  padding: '3px 6px',
                  borderRadius: 6,
                  fontSize: 10,
                  cursor: 'pointer'
                }}
                title="Toggle Satellite / Road view"
              >
                {googleMapType === 'roadmap' ? 'Sat' : 'Map'}
              </button>
            )}
          </div>
        </div>

        {/* RED DANGER ZONE / GREEN SAFE ZONE LEGEND PILL */}
        <div
          style={{
            background: 'rgba(11, 15, 25, 0.92)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: 8,
            padding: '4px 10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 10
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#EF4444', display: 'inline-block' }}></span>
            <span style={{ color: '#FCA5A5', fontWeight: 800 }}>RED AREA: Flood Hazard (CRITICAL)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981', display: 'inline-block' }}></span>
            <span style={{ color: '#A7F3D0', fontWeight: 800 }}>GREEN AREA: Safe Shelter</span>
          </div>
        </div>

        {/* POPUP ALERT IF PERSON FROM RED AREA GIVES SOS */}
        {activeRedAlertBanner && (
          <div
            onClick={() => setRedZoneSosPopup(activeRedAlertBanner)}
            style={{
              background: 'linear-gradient(90deg, rgba(239, 68, 68, 0.95), rgba(185, 28, 28, 0.95))',
              border: '1px solid #FECACA',
              borderRadius: 10,
              padding: '6px 10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 4px 15px rgba(239, 68, 68, 0.6)',
              cursor: 'pointer',
              animation: 'pulse 1.5s infinite'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 14 }}>🚨</span>
              <div>
                <div style={{ color: '#FFF', fontWeight: 900, fontSize: 10, letterSpacing: '0.04em' }}>
                  RED AREA SOS: {activeRedAlertBanner.id}
                </div>
                <div style={{ color: '#FEE2E2', fontSize: 9 }}>
                  Sender: {activeRedAlertBanner.senderId || 'PERSON-A'} | Priority: CRITICAL
                </div>
              </div>
            </div>
            <span
              style={{
                background: 'rgba(0,0,0,0.3)',
                color: '#FFF',
                padding: '2px 6px',
                borderRadius: 4,
                fontWeight: 800,
                fontSize: 9
              }}
            >
              POPUP
            </span>
          </div>
        )}
      </div>

      {/* 4. Simulated Offline Fallback Screen */}
      {simulateOfflineMapTiles && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: '#F8FAFC',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            textAlign: 'center',
            gap: 14,
            zIndex: 100
          }}
        >
          <div
            style={{
              width: 54,
              height: 54,
              borderRadius: '50%',
              background: '#FEF2F2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#DC2626'
            }}
          >
            <WifiOff size={28} />
          </div>

          <div style={{ fontSize: 16, fontWeight: 900, color: '#0F172A' }}>
            MAP TILES OFFLINE
          </div>

          <div style={{ fontSize: 13, color: '#475569', maxWidth: 280 }}>
            Device GPS coordinates and Store-Carry-Forward mesh routing remain fully operational.
          </div>

          <button
            onClick={() => setSimulateOfflineMapTiles(false)}
            style={{
              height: 40,
              background: '#2563EB',
              border: 'none',
              borderRadius: 10,
              padding: '0 20px',
              color: '#FFFFFF',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer'
            }}
          >
            Restore Map View
          </button>
        </div>
      )}

      {/* 5. Bottom Map Controls */}
      <div
        style={{
          position: 'absolute',
          bottom: 12,
          left: 12,
          right: 12,
          zIndex: 400,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#FFFFFF',
          border: '1px solid #CBD5E1',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          padding: '6px 12px',
          borderRadius: 12,
          fontSize: 12,
          pointerEvents: 'auto'
        }}
      >
        <div style={{ color: '#475569', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
          <span style={{ color: '#16A34A', fontSize: 14 }}>●</span>
          <span>{mapEngine === 'GOOGLE' ? 'Google Maps API' : 'Tactical Vector Map'}</span>
        </div>

        <button
          onClick={() => setSimulateOfflineMapTiles(!simulateOfflineMapTiles)}
          style={{
            background: '#EFF6FF',
            border: '1px solid #BFDBFE',
            color: '#2563EB',
            fontSize: 12,
            fontWeight: 700,
            padding: '4px 10px',
            borderRadius: 8,
            cursor: 'pointer'
          }}
        >
          {simulateOfflineMapTiles ? 'Restore' : 'Offline Mode'}
        </button>
      </div>
    </div>
  );
};
