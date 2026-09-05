import { RateLimitState } from '../types';

const STORAGE_KEY_TIMESTAMPS = 'lifeline_sos_sent_timestamps';
const ONE_HOUR_MS = 60 * 60 * 1000;
const TWENTY_FOUR_HOURS_MS = 24 * ONE_HOUR_MS;
const MAX_PER_HOUR = 2;
const MAX_PER_24_HOURS = 6;

export class SosRateLimiter {
  private getStoredTimestamps(): number[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY_TIMESTAMPS);
      if (!data) return [];
      const parsed: number[] = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private saveTimestamps(timestamps: number[]): void {
    localStorage.setItem(STORAGE_KEY_TIMESTAMPS, JSON.stringify(timestamps));
  }

  /**
   * Evaluates current rate limit state.
   */
  getState(): RateLimitState {
    const now = Date.now();
    const all = this.getStoredTimestamps();

    // Filter within 1 hour
    const inOneHour = all.filter(t => now - t < ONE_HOUR_MS);
    // Filter within 24 hours
    const in24Hours = all.filter(t => now - t < TWENTY_FOUR_HOURS_MS);

    // Save cleaned timestamps
    if (all.length !== in24Hours.length) {
      this.saveTimestamps(in24Hours);
    }

    const countInWindow = inOneHour.length;
    const isPerHourLimitReached = countInWindow >= MAX_PER_HOUR;
    const is24HourLimitReached = in24Hours.length >= MAX_PER_24_HOURS;

    const canSend = !isPerHourLimitReached && !is24HourLimitReached;

    let cooldownRemainingSeconds = 0;
    if (isPerHourLimitReached && inOneHour.length > 0) {
      // Oldest timestamp in current 1-hour window determines when the next slot opens
      const oldestInWindow = Math.min(...inOneHour);
      const timeRemainingMs = oldestInWindow + ONE_HOUR_MS - now;
      cooldownRemainingSeconds = Math.max(0, Math.ceil(timeRemainingMs / 1000));
    } else if (is24HourLimitReached && in24Hours.length > 0) {
      const oldestIn24h = Math.min(...in24Hours);
      const timeRemainingMs = oldestIn24h + TWENTY_FOUR_HOURS_MS - now;
      cooldownRemainingSeconds = Math.max(0, Math.ceil(timeRemainingMs / 1000));
    }

    return {
      countInWindow,
      maxAllowed: MAX_PER_HOUR,
      windowHours: 1,
      timestamps: inOneHour,
      canSend,
      cooldownRemainingSeconds,
      twentyFourHourCount: in24Hours.length
    };
  }

  /**
   * Attempts to register a new SOS. Returns true if allowed, false if blocked.
   */
  recordSos(): boolean {
    const state = this.getState();
    if (!state.canSend) {
      return false;
    }

    const timestamps = this.getStoredTimestamps();
    timestamps.push(Date.now());
    this.saveTimestamps(timestamps);
    return true;
  }

  /**
   * Reset limits for test/demo mode.
   */
  resetLimit(): void {
    localStorage.removeItem(STORAGE_KEY_TIMESTAMPS);
  }

  /**
   * Formats seconds into MM:SS or HH:MM:SS
   */
  formatRemainingTime(seconds: number): string {
    if (seconds <= 0) return '00:00';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m < 60) {
      return `${m}m ${s.toString().padStart(2, '0')}s`;
    }
    const h = Math.floor(m / 60);
    const remM = m % 60;
    return `${h}h ${remM}m`;
  }
}

export const rateLimiter = new SosRateLimiter();
