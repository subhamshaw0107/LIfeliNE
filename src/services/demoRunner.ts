export interface DemoStepDetail {
  stepNumber: number;
  title: string;
  badge: string;
  description: string;
  actionSummary: string;
}

export const DEMO_STEPS: DemoStepDetail[] = [
  {
    stepNumber: 1,
    title: 'Disaster Inception',
    badge: 'FLOOD ALERT',
    description: 'Flash flood begins along the river embankment. Water rises rapidly at 0.5m/hour.',
    actionSummary: 'Disaster event triggered'
  },
  {
    stepNumber: 2,
    title: 'Perimeter Visualization',
    badge: 'MAP OVERLAY',
    description: 'Hazard perimeter appears on the live tactical map with 1.1 km radius danger zone.',
    actionSummary: 'Disaster zone mapped at 22.9785, 88.4395'
  },
  {
    stepNumber: 3,
    title: 'Victim Proximity Detection',
    badge: 'GPS CALCULATION',
    description: 'Victim GPS coordinates (22.9756, 88.4345) are evaluated against the flood origin.',
    actionSummary: 'Distance calculated: 0.7 km via Haversine formula'
  },
  {
    stepNumber: 4,
    title: 'Risk Classification',
    badge: '🔴 CRITICAL',
    description: 'Victim is within high-danger radius. Proximity status changes to RED / CRITICAL.',
    actionSummary: 'Victim status marker updated to CRITICAL'
  },
  {
    stepNumber: 5,
    title: 'Infrastructure Blackout',
    badge: 'OFFLINE TRIGGER',
    description: 'Cell towers fail and power grid collapses. Cellular & Internet go completely dark.',
    actionSummary: 'Internet: 🔴 OFFLINE | Cellular: 🔴 DOWN | Mesh: 🟢 ACTIVE'
  },
  {
    stepNumber: 6,
    title: 'One-Tap Emergency SOS',
    badge: 'VICTIM ACTION',
    description: 'Victim taps [SEND SOS]. Zero questions, zero forms, zero typing required.',
    actionSummary: 'Instant SOS trigger activated'
  },
  {
    stepNumber: 7,
    title: 'Encrypted Packet Generation',
    badge: 'AES-GCM-256',
    description: 'App generates unique SOS ID, attaches coordinates and device ID, then encrypts payload with 256-bit AES-GCM.',
    actionSummary: 'SOS-7F82A91C created and locked with unique IV'
  },
  {
    stepNumber: 8,
    title: 'Mesh Neighbor Discovery',
    badge: 'RADIO SCAN',
    description: 'Victim device broadcasts over offline radio spectrum looking for compatible nodes within 1 km.',
    actionSummary: 'Scanning for nearby mesh devices...'
  },
  {
    stepNumber: 9,
    title: 'Store-Carry Delay Phase',
    badge: 'STORE-CARRY',
    description: 'Initial scan finds no active nodes within range. SOS is safely buffered in local flash storage.',
    actionSummary: 'WAITING FOR NEARBY DEVICE (DTN buffer active)'
  },
  {
    stepNumber: 10,
    title: 'Node Enters 1 KM Range',
    badge: 'NODE DETECTED',
    description: 'Civil volunteer node enters 0.6 km communication radius. Hardware handshake succeeds.',
    actionSummary: 'Node 01 detected at 0.6 km (🟢 CONNECTED)'
  },
  {
    stepNumber: 11,
    title: 'Store-Carry-Forward Handover',
    badge: 'MESH RELAY',
    description: 'Packet transfers automatically: Victim Phone → Relay Node 01 → Relay Node 02 → Rescue Gateway.',
    actionSummary: 'Multi-hop relay in progress (3 hops)'
  },
  {
    stepNumber: 12,
    title: 'Rescue Gateway Alert',
    badge: 'CRITICAL DISPATCH',
    description: 'Tactical HQ receives encrypted packet. Payload authenticated. Emergency chime sounds.',
    actionSummary: 'Rescue Command Center alerted: SOS-7F82A91C'
  },
  {
    stepNumber: 13,
    title: 'Command Acknowledgement',
    badge: 'ACKNOWLEDGED',
    description: 'Rescue dispatcher clicks [ACKNOWLEDGE SOS]. Reverse mesh beacon returns receipt to victim.',
    actionSummary: 'Status: 🟠 RESCUE TEAM NOTIFIED'
  },
  {
    stepNumber: 14,
    title: 'Tactical GPS Lock',
    badge: 'TACTICAL MAP',
    description: 'Command center views exact coordinates (±8m accuracy) and computes fastest water-rescue route.',
    actionSummary: 'Rescue Team GPS Lock: 22.9756, 88.4345 (0.7 km from flood)'
  },
  {
    stepNumber: 15,
    title: 'Deployment & Response',
    badge: 'IN PROGRESS',
    description: 'Boat team dispatched. Status advances to [RESCUE IN PROGRESS]. Victim phone displays reassuring update.',
    actionSummary: 'Status: 🔵 RESCUE TEAM RESPONDING'
  },
  {
    stepNumber: 16,
    title: 'Safe Evacuation Complete',
    badge: 'RESCUED ✓',
    description: 'Victim successfully evacuated to High School Relief Center shelter. Marker turns green.',
    actionSummary: 'Status: 🟢 RESCUED ✓ (Mission Accomplished)'
  }
];
