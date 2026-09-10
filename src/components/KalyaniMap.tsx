import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useApp } from '../context/AppContext';

interface KalyaniMapProps {
  isRescueView?: boolean;
  onSelectSos?: (sosId: string) => void;
  height?: string | number;
  className?: string;
}

// Verified Kalyani, West Bengal Coordinates
const KALYANI_CENTER: [number, number] = [22.9750, 88.4345];
const KALYANI_STATION: [number, number] = [22.9692, 88.4674];
const JIS_COLLEGE: [number, number] = [22.9592, 88.4467];

export const KalyaniMap: React.FC<KalyaniMapProps> = ({
  onSelectSos,
  height = '100%',
  className = ''
}) => {
  const { location, sosList, disasterZones } = useApp();
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  // Initialize Leaflet Map centered on Kalyani
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: KALYANI_CENTER,
        zoom: 14,
        minZoom: 11,
        maxZoom: 18,
        zoomControl: true,
        attributionControl: false
      });

      // Standard OpenStreetMap tiles
      const osmTileLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
      });

      // Offline fallback: if internet is unavailable, load from packaged local tiles
      osmTileLayer.on('tileerror', (e: L.TileEvent) => {
        const img = e.tile as HTMLImageElement | undefined;
        if (img && !img.dataset.fallbackLoaded) {
          img.dataset.fallbackLoaded = 'true';
          const coords = (e as any).coords;
          if (coords) {
            img.src = `/tiles/${coords.z}/${coords.x}/${coords.y}.png`;
          }
        }
      });

      osmTileLayer.addTo(map);

      const markersGroup = L.layerGroup().addTo(map);
      markersLayerRef.current = markersGroup;
      mapInstanceRef.current = map;

      // Ensure proper sizing
      setTimeout(() => {
        map.invalidateSize();
      }, 200);
    }

    return () => {
      // Graceful cleanup on unmount
    };
  }, []);

  // Update Markers when location or sosList changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layer = markersLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();

    // 1. 🚆 Kalyani Railway Station Marker
    const stationIcon = L.divIcon({
      className: 'kalyani-pin-station',
      html: `<div style="background:#2563EB; color:#FFF; font-size:10px; font-weight:800; padding:3px 8px; border-radius:12px; border:2px solid #FFF; box-shadow:0 2px 6px rgba(0,0,0,0.3); white-space:nowrap; display:flex; align-items:center; gap:4px;"><span>🚆</span><span>Kalyani Station</span></div>`,
      iconSize: [120, 24],
      iconAnchor: [60, 12]
    });
    L.marker(KALYANI_STATION, { icon: stationIcon })
      .bindPopup(`<b>🚆 Kalyani Railway Station</b><br>Kalyani, Nadia, West Bengal`)
      .addTo(layer);

    // 2. 🎓 JIS College of Engineering Marker
    const collegeIcon = L.divIcon({
      className: 'kalyani-pin-college',
      html: `<div style="background:#059669; color:#FFF; font-size:10px; font-weight:800; padding:3px 8px; border-radius:12px; border:2px solid #FFF; box-shadow:0 2px 6px rgba(0,0,0,0.3); white-space:nowrap; display:flex; align-items:center; gap:4px;"><span>🎓</span><span>JIS College</span></div>`,
      iconSize: [110, 24],
      iconAnchor: [55, 12]
    });
    L.marker(JIS_COLLEGE, { icon: collegeIcon })
      .bindPopup(`<b>🎓 JIS College of Engineering</b><br>Block A, Phase III, Kalyani`)
      .addTo(layer);

    // 3. 📍 User Current Location Pin (if provided by existing state)
    if (location && location.latitude && location.longitude) {
      const userIcon = L.divIcon({
        className: 'kalyani-user-pin',
        html: `<div style="background:#0284C7; width:16px; height:16px; border-radius:50%; border:3px solid #FFF; box-shadow:0 0 10px #0284C7;"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      });
      L.marker([location.latitude, location.longitude], { icon: userIcon })
        .bindPopup(`<b>📍 Your Location</b><br>Lat: ${location.latitude.toFixed(4)}, Lon: ${location.longitude.toFixed(4)}`)
        .addTo(layer);
    }

    // 4. 🚨 Existing SOS Pins (Read-only from existing frontend sosList)
    if (sosList && sosList.length > 0) {
      sosList.forEach(sos => {
        const color = sos.priority === 'CRITICAL' ? '#EF4444' : sos.priority === 'HIGH' ? '#F59E0B' : '#10B981';
        const sosIcon = L.divIcon({
          className: 'kalyani-sos-pin',
          html: `<div style="background:${color}; width:16px; height:16px; border-radius:50%; border:2px solid #FFF; box-shadow:0 0 10px ${color};"></div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8]
        });
        const m = L.marker([sos.latitude, sos.longitude], { icon: sosIcon })
          .bindPopup(`
            <div style="font-family:sans-serif; padding:4px;">
              <span style="background:${color}; color:#FFF; font-size:10px; font-weight:800; padding:2px 6px; border-radius:4px;">${sos.priority} SOS</span>
              <h4 style="margin:4px 0 2px; font-size:13px; color:${color};">${sos.id}</h4>
              <p style="margin:0; font-size:11px;">Sender: <strong>${sos.senderId || 'Survivor'}</strong></p>
              <p style="margin:2px 0 0; font-size:11px; font-style:italic;">"${sos.message}"</p>
            </div>
          `)
          .addTo(layer);

        if (onSelectSos) {
          m.on('click', () => onSelectSos(sos.id));
        }
      });
    }

    // 5. 🔴 Existing Disaster Hazard Zones
    if (disasterZones && disasterZones.length > 0) {
      disasterZones.forEach(zone => {
        L.circle([zone.latitude, zone.longitude], {
          radius: zone.radiusKm * 1000,
          color: '#EF4444',
          fillColor: '#EF4444',
          fillOpacity: 0.25,
          weight: 2,
          dashArray: '5, 5'
        })
          .bindPopup(`<b>🔴 ${zone.name}</b><br>${zone.description}`)
          .addTo(layer);
      });
    }
  }, [location, sosList, disasterZones, onSelectSos]);

  return (
    <div
      style={{
        width: '100%',
        height: height,
        borderRadius: 12,
        overflow: 'hidden',
        position: 'relative',
        border: '1px solid var(--border-card, #334155)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
      }}
      className={`kalyani-map-wrapper ${className}`}
    >
      <div
        ref={mapContainerRef}
        style={{
          width: '100%',
          height: '100%',
          minHeight: 350
        }}
      />
    </div>
  );
};

export default KalyaniMap;
