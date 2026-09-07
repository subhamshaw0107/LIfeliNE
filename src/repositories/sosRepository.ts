import { SosPacket, AckPacket, DeliveryStatus } from '../types';
import { StorageEngine, defaultStorageEngine } from '../storage/storageEngine';
import { createSosPacket, CreateSosPacketParams } from '../models/Packet';

export interface ISosRepository {
  createSos(params: CreateSosPacketParams): SosPacket;
  savePacket(packet: SosPacket): void;
  getPacket(packetId: string): SosPacket | null;
  getAllPackets(): SosPacket[];
  getPendingPackets(): SosPacket[];
  updatePacket(packet: SosPacket): void;
  updateStatus(
    packetId: string,
    status: DeliveryStatus,
    detail?: string,
    extraFields?: Partial<SosPacket>
  ): SosPacket | null;
  deletePacket(packetId: string): boolean;
  hasPacket(packetId: string): boolean;
  isSeen(packetId: string): boolean;
  markSeen(packetId: string): void;
  saveAck(ack: AckPacket): void;
  getAcksForSos(sosId: string): AckPacket[];
}

export class SosRepository implements ISosRepository {
  private storage: StorageEngine;

  constructor(storage: StorageEngine = defaultStorageEngine) {
    this.storage = storage;
  }

  createSos(params: CreateSosPacketParams): SosPacket {
    const packet = createSosPacket(params);
    this.storage.savePacket(packet);
    return packet;
  }

  savePacket(packet: SosPacket): void {
    this.storage.savePacket(packet);
  }

  getPacket(packetId: string): SosPacket | null {
    return this.storage.getPacket(packetId);
  }

  getAllPackets(): SosPacket[] {
    return this.storage.getAllPackets();
  }

  getPendingPackets(): SosPacket[] {
    return this.storage
      .getAllPackets()
      .filter(p => p.status === 'CREATED' || p.status === 'STORED' || p.status === 'RELAYING');
  }

  updatePacket(packet: SosPacket): void {
    this.storage.savePacket(packet);
  }

  updateStatus(
    packetId: string,
    status: DeliveryStatus,
    detail?: string,
    extraFields?: Partial<SosPacket>
  ): SosPacket | null {
    return this.storage.updatePacketStatus(packetId, status, detail, extraFields);
  }

  deletePacket(packetId: string): boolean {
    return this.storage.deletePacket(packetId);
  }

  hasPacket(packetId: string): boolean {
    return this.storage.hasPacket(packetId);
  }

  isSeen(packetId: string): boolean {
    return this.storage.isSeen(packetId);
  }

  markSeen(packetId: string): void {
    this.storage.markSeen(packetId);
  }

  saveAck(ack: AckPacket): void {
    this.storage.saveAck(ack);
    // Also update parent SOS status if present
    this.storage.updatePacketStatus(
      ack.sosId,
      ack.status,
      `ACK received from ${ack.acknowledgedBy}: ${ack.note || ''}`
    );
  }

  getAcksForSos(sosId: string): AckPacket[] {
    return this.storage.getAcksForSos(sosId);
  }
}

export const sosRepository = new SosRepository();
