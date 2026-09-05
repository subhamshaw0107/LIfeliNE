import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import {
  UserRole,
  MeshStatus,
  SimpleNetworkStatus,
  SosPacket,
  LocationCoords,
  UserAccount,
  RateLimitState,
  MeshNode,
  DisasterZone,
  DeliveryStatus
} from '../types';
import { cryptoService } from '../services/cryptoService';
import { geoService, calculatePriorityFromRisk, DEFAULT_DISASTER_ZONES, RESCUE_HEADQUARTERS } from '../services/geoService';
import { rateLimiter } from '../services/rateLimiter';
import { storageService } from '../services/storageService';
import { meshEngine, DEMO_MESH_NODES } from '../services/meshEngine';
import { audioService } from '../services/audioService';
import { DEMO_STEPS } from '../services/demoRunner';
import confetti from 'canvas-confetti';

interface AppContextType {
  user: UserAccount | null;
  role: UserRole;
  setRole: (role: UserRole) => void;
  login: (account: UserAccount) => void;
  logout: () => void;
  isInternetDown: boolean;
  setIsInternetDown: (down: boolean) => void;
  location: LocationCoords;
  updateLocation: (coords: Partial<LocationCoords>) => void;
  disasterZones: DisasterZone[];
  meshStatus: MeshStatus;
  meshNodes: MeshNode[];
  rateLimitState: RateLimitState;
  sosList: SosPacket[];
  victimActiveSos: SosPacket | null;
  sendSos: (customMsg?: string) => Promise<SosPacket | null>;
  markSafe: () => Promise<void>;
  sendQuickMessage: (text: string) => Promise<SosPacket | null>;
  acknowledgeSos: (sosId: string) => void;
  setRespondingSos: (sosId: string) => void;
  markRescuedSos: (sosId: string) => void;
  // Demo Mode
  isDemoActive: boolean;
  demoStep: number;
  demoAutoPlay: boolean;
  startDemo: () => void;
  stopDemo: () => void;
  nextDemoStep: () => void;
  prevDemoStep: () => void;
  toggleDemoAutoPlay: () => void;
  // Simple Mesh Network Status
  simpleNetworkStatus: SimpleNetworkStatus;
  setSimpleNetworkStatus: (status: SimpleNetworkStatus) => void;
  toggleSimulateNodeRange: () => boolean;
  // Audio
  audioMuted: boolean;
  toggleAudioMute: () => void;
  // Sync
  syncPending: boolean;
  syncWithCloud: () => Promise<void>;
  // Red Zone SOS Emergency Popup
  redZoneSosPopup: SosPacket | null;
  setRedZoneSosPopup: (packet: SosPacket | null) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Initial mock SOS packets in the system for realistic rescue triage dashboard
const INITIAL_MOCK_SOS: SosPacket[] = [
  {
    id: 'SOS-3B19E42D',
    senderId: 'PERSON-B',
    deviceId: 'DEV-98C41A',
    userId: 'PERSON-B',
    userName: 'PERSON-B',
    timestamp: Date.now() - 14 * 60 * 1000,
    timeFormatted: '12:01:24',
    latitude: 22.9772,
    longitude: 88.4378,
    gpsAccuracy: 7,
    priority: 'CRITICAL',
    riskLevel: 'CRITICAL',
    disasterZoneName: 'Flood Zone A (River Embankment Breach)',
    distanceFromDisasterKm: 0.35,
    distanceFromRescueKm: 2.1,
    message: 'Water inside 1st floor. Elderly person with breathing difficulty.',
    messageType: 'SOS',
    ttl: 3,
    hopCount: 2,
    route: ['PERSON-B', 'Relay Node 01', 'RESCUE CENTER'],
    status: 'RESPONDING',
    encryptionStatus: 'AUTHENTICATED_AES_GCM_VALID',
    encryptedPayload: '9f83a2c071b56a9082ec15d83301a75c',
    iv: 'a1b2c3d4e5f60718293a4b5c',
    batteryLevel: 38,
    createdAt: Date.now() - 14 * 60 * 1000,
    acknowledgedAt: Date.now() - 10 * 60 * 1000,
    respondingAt: Date.now() - 6 * 60 * 1000,
    statusHistory: [
      { status: 'CREATED', timestamp: Date.now() - 14 * 60 * 1000, detail: 'SOS packet created by PERSON-B' },
      { status: 'DELIVERED', timestamp: Date.now() - 12 * 60 * 1000, detail: 'Delivered through mesh' },
      { status: 'ACKNOWLEDGED', timestamp: Date.now() - 10 * 60 * 1000, detail: 'Acknowledged by Rescue Team' },
      { status: 'RESPONDING', timestamp: Date.now() - 6 * 60 * 1000, detail: 'Inflatable boat unit dispatched' }
    ]
  },
  {
    id: 'SOS-8C91FA02',
    senderId: 'PERSON-C',
    deviceId: 'DEV-44F27E',
    userId: 'PERSON-C',
    userName: 'PERSON-C',
    timestamp: Date.now() - 28 * 60 * 1000,
    timeFormatted: '11:47:19',
    latitude: 22.9825,
    longitude: 88.4460,
    gpsAccuracy: 12,
    priority: 'HIGH',
    riskLevel: 'WARNING',
    disasterZoneName: 'Flood Zone A',
    distanceFromDisasterKm: 1.4,
    distanceFromRescueKm: 1.2,
    message: 'Road blocked by fallen tree. 4 people on rooftop.',
    messageType: 'SOS',
    ttl: 2,
    hopCount: 3,
    route: ['PERSON-C', 'Node 02', 'Node 03', 'RESCUE CENTER'],
    status: 'ACKNOWLEDGED',
    encryptionStatus: 'AUTHENTICATED_AES_GCM_VALID',
    encryptedPayload: '7c42b8e190ff312aa4058d1976a2e410',
    iv: '66a578bc901e23f478a9c12b',
    batteryLevel: 62,
    createdAt: Date.now() - 28 * 60 * 1000,
    acknowledgedAt: Date.now() - 20 * 60 * 1000,
    statusHistory: [
      { status: 'CREATED', timestamp: Date.now() - 28 * 60 * 1000, detail: 'SOS packet created by PERSON-C' },
      { status: 'DELIVERED', timestamp: Date.now() - 24 * 60 * 1000, detail: 'Delivered via multi-hop mesh' },
      { status: 'ACKNOWLEDGED', timestamp: Date.now() - 20 * 60 * 1000, detail: 'Rescue team acknowledged' }
    ]
  },
  {
    id: 'SOS-11DA49E7',
    senderId: 'PERSON-D',
    deviceId: 'DEV-19A82B',
    userId: 'PERSON-D',
    userName: 'PERSON-D',
    timestamp: Date.now() - 45 * 60 * 1000,
    timeFormatted: '11:30:05',
    latitude: 22.9705,
    longitude: 88.4280,
    gpsAccuracy: 6,
    priority: 'LOW',
    riskLevel: 'SAFE',
    disasterZoneName: 'Outside flood basin',
    distanceFromDisasterKm: 2.8,
    distanceFromRescueKm: 3.4,
    message: 'We are safe at community center. Electricity out.',
    messageType: 'STATUS_UPDATE',
    ttl: 4,
    hopCount: 1,
    route: ['PERSON-D', 'Relay Node 01', 'RESCUE CENTER'],
    status: 'RESCUED',
    encryptionStatus: 'AUTHENTICATED_AES_GCM_VALID',
    encryptedPayload: '33e145f90a2b8812c4075199d8e7aa14',
    iv: '9901a8efbc127634de56fa01',
    batteryLevel: 81,
    createdAt: Date.now() - 45 * 60 * 1000,
    acknowledgedAt: Date.now() - 35 * 60 * 1000,
    rescuedAt: Date.now() - 15 * 60 * 1000,
    statusHistory: [
      { status: 'CREATED', timestamp: Date.now() - 45 * 60 * 1000, detail: 'Status update created by PERSON-D' },
      { status: 'RESCUED', timestamp: Date.now() - 15 * 60 * 1000, detail: 'Confirmed safe at relief shelter' }
    ]
  }
];

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Current user / role - defaults to PERSON-A
  const [user, setUser] = useState<UserAccount | null>({
    userId: 'PERSON-A',
    name: 'PERSON-A',
    phoneId: cryptoService.getOrCreateDeviceId(),
    role: 'VICTIM',
    emergencyContact: '+91 98765 43210'
  });
  const [role, setRole] = useState<UserRole>('VICTIM');

  // Network offline state (pure mesh simulation)
  const [isInternetDown, setIsInternetDown] = useState<boolean>(true);

  // Victim location (default 22.9756, 88.4345 matching prompt)
  const [location, setLocation] = useState<LocationCoords>({
    latitude: 22.9756,
    longitude: 88.4345,
    accuracy: 8,
    lastUpdated: Date.now()
  });

  // Disaster zones
  const [disasterZones] = useState<DisasterZone[]>(DEFAULT_DISASTER_ZONES);

  // Mesh status and nodes
  const [meshNodes, setMeshNodes] = useState<MeshNode[]>(DEMO_MESH_NODES);
  const [meshStatus, setMeshStatus] = useState<MeshStatus>('CONNECTED');
  const [simpleNetworkStatus, setSimpleNetworkStatus] = useState<SimpleNetworkStatus>('CONNECTED');

  // SOS state
  const [sosList, setSosList] = useState<SosPacket[]>(() => {
    const stored = storageService.getStoredSosPackets();
    return stored.length > 0 ? stored : INITIAL_MOCK_SOS;
  });

  const [victimActiveSos, setVictimActiveSos] = useState<SosPacket | null>(null);

  // Rate Limiting
  const [rateLimitState, setRateLimitState] = useState<RateLimitState>(() => rateLimiter.getState());

  // Demo Runner State
  const [isDemoActive, setIsDemoActive] = useState<boolean>(false);
  const [demoStep, setDemoStep] = useState<number>(1);
  const [demoAutoPlay, setDemoAutoPlay] = useState<boolean>(false);

  // Audio mute
  const [audioMuted, setAudioMuted] = useState<boolean>(false);

  // Cloud sync
  const [syncPending, setSyncPending] = useState<boolean>(false);

  // Red Zone SOS Emergency Popup State
  const [redZoneSosPopup, setRedZoneSosPopup] = useState<SosPacket | null>(null);

  // Update mesh status based on location
  const refreshMeshStatus = useCallback(() => {
    const res = meshEngine.getVictimMeshStatus(location.latitude, location.longitude);
    setMeshStatus(res.status);
    setMeshNodes([...meshEngine.getNodes()]);
  }, [location.latitude, location.longitude]);

  useEffect(() => {
    refreshMeshStatus();
  }, [refreshMeshStatus]);

  // Subscribe to simple mesh network status changes
  useEffect(() => {
    const unsub = meshEngine.onNetworkStatusChange((status) => {
      setSimpleNetworkStatus(status);
    });
    return () => unsub();
  }, []);

  const toggleSimulateNodeRange = () => {
    const isNowInRange = meshEngine.toggleSimulateNodeRange(location.latitude, location.longitude);
    setMeshNodes([...meshEngine.getNodes()]);
    refreshMeshStatus();
    return isNowInRange;
  };

  // Rate limit countdown tick
  useEffect(() => {
    const interval = setInterval(() => {
      setRateLimitState(rateLimiter.getState());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Sync SOS list with storage service
  useEffect(() => {
    if (sosList.length > 0) {
      localStorage.setItem('lifeline_stored_sos_packets', JSON.stringify(sosList));
    }
  }, [sosList]);

  // Authentication
  const login = (account: UserAccount) => {
    setUser(account);
    setRole(account.role);
  };

  const logout = () => {
    setUser(null);
  };

  const updateLocation = (coords: Partial<LocationCoords>) => {
    setLocation(prev => ({
      ...prev,
      ...coords,
      lastUpdated: Date.now()
    }));
  };

  // DYNAMIC SOS PRIORITY ADAPTATION:
  // Automatically adapts the priority of an active SOS when sender's disaster-risk status changes.
  // The victim does NOT manually update anything.
  // The SOS ID remains exactly the same. No new SOS is created.
  // The updated priority propagates through the mesh relay system and updates Rescue Center records.
  useEffect(() => {
    if (!victimActiveSos) return;
    if (victimActiveSos.status === 'RESCUED') return;

    const riskEval = geoService.evaluateDisasterRisk(location.latitude, location.longitude, disasterZones);
    const updatedPriority = calculatePriorityFromRisk(riskEval.riskLevel);

    if (victimActiveSos.priority !== updatedPriority) {
      const oldPriority = victimActiveSos.priority;
      const historyEntry = {
        status: victimActiveSos.status,
        timestamp: Date.now(),
        detail: `Dynamic Priority adapted: ${oldPriority} → ${updatedPriority} (${riskEval.riskLevel} zone)`
      };

      const adaptedPacket: SosPacket = {
        ...victimActiveSos,
        priority: updatedPriority,
        riskLevel: riskEval.riskLevel,
        latitude: location.latitude,
        longitude: location.longitude,
        distanceFromDisasterKm: riskEval.distanceKm,
        distanceFromRescueKm: riskEval.distanceToRescueKm,
        disasterZoneName: riskEval.closestZone.name,
        statusHistory: [...(victimActiveSos.statusHistory || []), historyEntry]
      };

      // 1. Keep exact same SOS ID, update victim's active SOS
      setVictimActiveSos(adaptedPacket);

      // 2. Persist to storage
      storageService.saveSosPacket(adaptedPacket);

      // 3. Update Rescue Center incident queue records
      setSosList(prev => prev.map(p => p.id === adaptedPacket.id ? adaptedPacket : p));

      // 4. Update in-flight / queued packets in mesh engine so relays carry the updated priority
      meshEngine.updatePacketPriority(adaptedPacket.id, updatedPriority, riskEval.riskLevel);
    }
  }, [location.latitude, location.longitude, disasterZones, victimActiveSos?.id, victimActiveSos?.priority]);

  const toggleAudioMute = () => {
    const muted = audioService.toggleMute();
    setAudioMuted(muted);
  };

  // SEND SOS (Zero questionnaire, instant execution)
  const sendSos = async (customMsg?: string): Promise<SosPacket | null> => {
    // 1. Check rate limit
    const allowed = rateLimiter.recordSos();
    setRateLimitState(rateLimiter.getState());

    if (!allowed) {
      alert('SOS LIMIT REACHED\nYou have used 2 SOS requests in the current 1-hour period.\nPlease wait until the limit resets.');
      return null;
    }

    // Audio / Haptic feedback
    audioService.playSosPulse();

    // 2. Capture parameters
    const sosId = cryptoService.generateSosId();
    const deviceId = user?.phoneId || cryptoService.getOrCreateDeviceId();
    const now = Date.now();
    const dateObj = new Date(now);
    const timeFormatted = dateObj.toTimeString().split(' ')[0];

    // 3. Compute disaster proximity & automatically determine emergency priority
    const riskEval = geoService.evaluateDisasterRisk(location.latitude, location.longitude, disasterZones);
    const autoPriority = calculatePriorityFromRisk(riskEval.riskLevel);

    // 4. Extract senderId (never include password or unnecessary info)
    const senderId = user?.userId?.trim() || 'PERSON-A';

    // Create raw payload with senderId and automatically calculated priority
    const rawPayload = {
      sosId,
      senderId,
      latitude: location.latitude,
      longitude: location.longitude,
      gpsAccuracy: location.accuracy,
      timestamp: now,
      timeFormatted,
      priority: autoPriority,
      riskLevel: riskEval.riskLevel,
      disasterZone: riskEval.closestZone.name,
      distanceDisasterKm: riskEval.distanceKm,
      message: customMsg || 'I need help.'
    };

    // 5. Encrypt with AES-GCM 256
    const encResult = await cryptoService.encryptSosPayload(rawPayload);

    // 6. Build SosPacket - senderId and auto-calculated priority are preserved throughout mesh forwarding
    const newPacket: SosPacket = {
      id: sosId,
      senderId,
      deviceId,
      userId: senderId,
      userName: senderId,
      timestamp: now,
      timeFormatted,
      latitude: location.latitude,
      longitude: location.longitude,
      gpsAccuracy: location.accuracy,
      priority: autoPriority,
      riskLevel: riskEval.riskLevel,
      disasterZoneName: riskEval.closestZone.name,
      distanceFromDisasterKm: riskEval.distanceKm,
      distanceFromRescueKm: riskEval.distanceToRescueKm,
      message: rawPayload.message,
      messageType: 'SOS',
      ttl: 5,
      hopCount: 0,
      route: [senderId],
      status: 'CREATED',
      encryptionStatus: 'AUTHENTICATED_AES_GCM_VALID',
      encryptedPayload: encResult.ciphertext,
      iv: encResult.iv,
      batteryLevel: 79,
      createdAt: now,
      statusHistory: [
        { status: 'CREATED', timestamp: now, detail: `SOS created by sender ${senderId}` },
        { status: 'ENCRYPTED', timestamp: now + 50, detail: 'Payload encrypted with 256-bit AES-GCM' },
        { status: 'STORED', timestamp: now + 100, detail: 'Stored locally in flash memory' }
      ]
    };

    // Save locally
    storageService.saveSosPacket(newPacket);
    setVictimActiveSos(newPacket);
    setSosList(prev => [newPacket, ...prev.filter(p => p.id !== newPacket.id)]);

    // IF PERSON FROM RED AREA GIVES SOS -> TRIGGER POPUP!
    if (riskEval.riskLevel === 'CRITICAL') {
      setRedZoneSosPopup(newPacket);
    }

    // 7. Start Mesh Store-Carry-Forward routing asynchronously
    meshEngine.routeSosPacket(
      newPacket,
      location.latitude,
      location.longitude,
      (_stepName, updatedPacket) => {
        setVictimActiveSos({ ...updatedPacket });
        setSosList(prev => [updatedPacket, ...prev.filter(p => p.id !== updatedPacket.id)]);
      }
    ).then((reachedGateway) => {
      if (reachedGateway) {
        // Sound dispatch alert at rescue side
        audioService.playEmergencyAlarm();
      }
    });

    return newPacket;
  };

  // Mark I'm Safe
  const markSafe = async () => {
    await sendSos("I AM SAFE. Outside immediate danger zone.");
  };

  // Quick message
  const sendQuickMessage = async (text: string): Promise<SosPacket | null> => {
    return await sendSos(text);
  };

  // Rescue Team actions
  const acknowledgeSos = (sosId: string) => {
    audioService.playAcknowledgeChime();
    const updated = storageService.updateSosStatus(
      sosId,
      'ACKNOWLEDGED',
      'Rescue Dispatch acknowledged receipt. Drone reconnaissance initiated.',
      { acknowledgedAt: Date.now() }
    );
    if (updated) {
      setSosList(prev => prev.map(p => p.id === sosId ? { ...p, status: 'ACKNOWLEDGED', acknowledgedAt: Date.now() } : p));
      if (victimActiveSos?.id === sosId) {
        setVictimActiveSos(prev => prev ? { ...prev, status: 'ACKNOWLEDGED', acknowledgedAt: Date.now() } : null);
      }
    }
  };

  const setRespondingSos = (sosId: string) => {
    audioService.playAcknowledgeChime();
    const updated = storageService.updateSosStatus(
      sosId,
      'RESPONDING',
      'Field rescue vehicle and paramedics deployed to victim coordinates.',
      { respondingAt: Date.now() }
    );
    if (updated) {
      setSosList(prev => prev.map(p => p.id === sosId ? { ...p, status: 'RESPONDING', respondingAt: Date.now() } : p));
      if (victimActiveSos?.id === sosId) {
        setVictimActiveSos(prev => prev ? { ...prev, status: 'RESPONDING', respondingAt: Date.now() } : null);
      }
    }
  };

  const markRescuedSos = (sosId: string) => {
    audioService.playAcknowledgeChime();
    try {
      confetti({ particleCount: 75, spread: 60, origin: { y: 0.6 } });
    } catch {
      // ignore
    }
    const updated = storageService.updateSosStatus(
      sosId,
      'RESCUED',
      'Victim verified safe and evacuated to designated shelter.',
      { rescuedAt: Date.now() }
    );
    if (updated) {
      setSosList(prev => prev.map(p => p.id === sosId ? { ...p, status: 'RESCUED', rescuedAt: Date.now() } : p));
      if (victimActiveSos?.id === sosId) {
        setVictimActiveSos(prev => prev ? { ...prev, status: 'RESCUED', rescuedAt: Date.now() } : null);
      }
    }
  };

  // Cloud sync when internet returns
  const syncWithCloud = async () => {
    setSyncPending(true);
    await new Promise(r => setTimeout(r, 1200));
    storageService.clearSyncQueue();
    setSyncPending(false);
    audioService.playAcknowledgeChime();
  };

  // Demo Mode Runner
  const startDemo = () => {
    setIsDemoActive(true);
    setDemoStep(1);
    setDemoAutoPlay(true);
  };

  const stopDemo = () => {
    setIsDemoActive(false);
    setDemoAutoPlay(false);
  };

  const nextDemoStep = () => {
    setDemoStep(prev => Math.min(prev + 1, DEMO_STEPS.length));
  };

  const prevDemoStep = () => {
    setDemoStep(prev => Math.max(prev - 1, 1));
  };

  const toggleDemoAutoPlay = () => {
    setDemoAutoPlay(prev => !prev);
  };

  // Execute demo actions per step
  useEffect(() => {
    if (!isDemoActive) return;

    const current = demoStep;
    if (current === 1) {
      // Flood begins
    } else if (current === 4) {
      // Risk turns critical
    } else if (current === 5) {
      // Internet turns off
      setIsInternetDown(true);
    } else if (current === 6) {
      // Auto trigger SOS if none active
      if (!victimActiveSos) {
        sendSos();
      }
    } else if (current === 12) {
      // Rescue alert
      audioService.playEmergencyAlarm();
    } else if (current === 13) {
      // Acknowledge
      if (victimActiveSos) acknowledgeSos(victimActiveSos.id);
    } else if (current === 15) {
      // Respond
      if (victimActiveSos) setRespondingSos(victimActiveSos.id);
    } else if (current === 16) {
      // Rescue
      if (victimActiveSos) markRescuedSos(victimActiveSos.id);
    }

    if (demoAutoPlay && demoStep < DEMO_STEPS.length) {
      const timer = setTimeout(() => {
        setDemoStep(s => s + 1);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [isDemoActive, demoStep, demoAutoPlay]);

  return (
    <AppContext.Provider
      value={{
        user,
        role,
        setRole,
        login,
        logout,
        isInternetDown,
        setIsInternetDown,
        location,
        updateLocation,
        disasterZones,
        meshStatus,
        meshNodes,
        rateLimitState,
        sosList,
        victimActiveSos,
        sendSos,
        markSafe,
        sendQuickMessage,
        acknowledgeSos,
        setRespondingSos,
        markRescuedSos,
        isDemoActive,
        demoStep,
        demoAutoPlay,
        startDemo,
        stopDemo,
        nextDemoStep,
        prevDemoStep,
        toggleDemoAutoPlay,
        simpleNetworkStatus,
        setSimpleNetworkStatus,
        toggleSimulateNodeRange,
        audioMuted,
        toggleAudioMute,
        syncPending,
        syncWithCloud,
        redZoneSosPopup,
        setRedZoneSosPopup
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
