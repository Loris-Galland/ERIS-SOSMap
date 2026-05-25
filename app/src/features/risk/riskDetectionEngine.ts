/*
 * Pure, stateful detection engine for behavioral risk analysis.
 * Has zero React dependencies — instantiated once inside useRiskDetection and testable in isolation.
 * Processes two independent data streams (GPS position and accelerometer motion) and emits RiskEvents
 * when a dangerous pattern is detected with sufficient confidence.
 *
 * Detection patterns:
 *   SUDDEN_STOP          — vehicular speed collapses to near-zero (accident)
 *   FALL_CONFIRMED       — free-fall → impact signature, or GPS immobility after an external fall event
 *   PROLONGED_IMMOBILITY — user was moving, is now still for longer than IMMOBILITY_THRESHOLD_MS
 */

import type { FallEventInput, MotionSample, PositionSample, RiskEvent, RiskLevel, RiskPattern } from './types';

// ─── Tunable thresholds ────────────────────────────────────────────────────────

const WALK_SPEED_MS        = 0.8;          // m/s — minimum to count as "moving"
const VEHICLE_SPEED_MS     = 8.0;          // m/s — ~29 km/h, vehicular movement
const STOP_SPEED_MS        = 0.4;          // m/s — below this = stationary (covers GPS drift)
const SUDDEN_STOP_WINDOW   = 12_000;       // ms — window to look back for high speed before a stop
const IMMOBILITY_THRESHOLD = 5 * 60_000;  // ms — 5 minutes of immobility triggers the alert
const MIN_MOVING_DURATION  = 45_000;       // ms — must have been moving for 45 s before immobility counts
const FALL_FREE_FALL_MAG   = 2.5;          // m/s² — magnitude below this = free-fall phase
const FALL_IMPACT_MAG      = 18.0;         // m/s² — magnitude above this = impact after fall
const FALL_LOOKBACK_SAMPLES = 20;          // last N motion samples (~4 s at 5 Hz) to search for pattern
const FALL_EVENT_TTL        = 90_000;      // ms — external fall event expires after 90 s
const COOLDOWN             = 4 * 60_000;  // ms — minimum time between two alerts of the same pattern

// ─── State machine ─────────────────────────────────────────────────────────────

type MovingState = 'IDLE' | 'MOVING' | 'STOPPED';

// Maps a RiskPattern to a camelCase i18n key segment
const I18N_KEY: Record<RiskPattern, string> = {
  SUDDEN_STOP:           'suddenStop',
  FALL_CONFIRMED:        'fallConfirmed',
  CRASH_CONFIRMED:       'crashConfirmed',
  PROLONGED_IMMOBILITY:  'prolongedImmobility',
};

export class RiskDetectionEngine {
  private gpsBuf: PositionSample[]    = [];
  private motionBuf: MotionSample[]   = [];
  private movingState: MovingState    = 'IDLE';
  private movingStartTime             = 0;
  private lastMovingTime              = 0;
  private lastFallEvent:  FallEventInput | null = null;
  private lastCrashEvent: FallEventInput | null = null;
  private cooldowns                    = new Map<RiskPattern, number>();

  // Feed a new GPS sample — returns a RiskEvent if a pattern fires, null otherwise
  addGpsSample(sample: PositionSample): RiskEvent | null {
    this.gpsBuf.push(sample);
    if (this.gpsBuf.length > 40) this.gpsBuf.shift();

    this.updateMovingState(sample);

    return (
      this.checkSuddenStop(sample.timestamp) ??
      this.checkFallConfirmed(sample.timestamp) ??
      this.checkProlongedImmobility(sample.timestamp)
    );
  }

  // Feed a new accelerometer sample — returns a RiskEvent if a fall signature is detected
  addMotionSample(sample: MotionSample): RiskEvent | null {
    this.motionBuf.push(sample);
    if (this.motionBuf.length > 150) this.motionBuf.shift(); // 30 s at 5 Hz

    return this.checkFallSignature(sample.timestamp);
  }

  // Register a fall event from useFallDetection — corroborated against GPS immobility
  reportFallEvent(event: FallEventInput): void {
    this.lastFallEvent = event;
  }

  // Register a crash event from useCrashDetection — fires immediately (speed-arming provides confidence)
  reportCrashEvent(event: FallEventInput): RiskEvent | null {
    if (this.isOnCooldown('CRASH_CONFIRMED', event.timestamp)) return null;
    this.lastCrashEvent = event;
    return this.buildEvent('CRASH_CONFIRMED', 'HIGH', 92, event.timestamp);
  }

  // Reset all state — useful for testing or when the user logs out
  reset(): void {
    this.gpsBuf         = [];
    this.motionBuf      = [];
    this.movingState    = 'IDLE';
    this.movingStartTime  = 0;
    this.lastMovingTime   = 0;
    this.lastFallEvent    = null;
    this.lastCrashEvent   = null;
    this.cooldowns.clear();
  }

  // ─── Private helpers ──────────────────────────────────────────────────────────

  // Advance the moving/stopped state machine based on current speed
  private updateMovingState(sample: PositionSample): void {
    const { speed, timestamp } = sample;
    if (speed > WALK_SPEED_MS) {
      if (this.movingState !== 'MOVING') this.movingStartTime = timestamp;
      this.movingState  = 'MOVING';
      this.lastMovingTime = timestamp;
    } else if (speed < STOP_SPEED_MS && this.movingState === 'MOVING') {
      this.movingState = 'STOPPED';
    }
  }

  // Detect high-speed movement followed by an abrupt stop within SUDDEN_STOP_WINDOW
  private checkSuddenStop(now: number): RiskEvent | null {
    if (this.gpsBuf.length < 4)              return null;
    if (this.isOnCooldown('SUDDEN_STOP', now)) return null;

    const recent    = this.gpsBuf.filter(s => now - s.timestamp <= SUDDEN_STOP_WINDOW);
    if (recent.length < 3) return null;

    const prevSpeeds   = recent.slice(0, -2).map(s => s.speed);
    const currentSpeed = this.gpsBuf.at(-1)!.speed;
    // Guard against empty slice — Math.max() with no args returns -Infinity
    if (prevSpeeds.length === 0) return null;
    const maxPrev = Math.max(...prevSpeeds);

    if (maxPrev > VEHICLE_SPEED_MS && currentSpeed < STOP_SPEED_MS) {
      return this.buildEvent('SUDDEN_STOP', 'HIGH', 75, now);
    }
    return null;
  }

  // Detect GPS immobility corroborated by an external fall event from Auto Fall Detection
  private checkFallConfirmed(now: number): RiskEvent | null {
    if (!this.lastFallEvent)                              return null;
    if (now - this.lastFallEvent.timestamp > FALL_EVENT_TTL) return null;
    if (this.movingState !== 'STOPPED')                   return null;
    if (this.isOnCooldown('FALL_CONFIRMED', now))         return null;

    return this.buildEvent('FALL_CONFIRMED', 'HIGH', 90, now);
  }

  // Detect the free-fall → impact acceleration signature directly from motion samples
  private checkFallSignature(now: number): RiskEvent | null {
    if (this.motionBuf.length < 10)               return null;
    if (this.isOnCooldown('FALL_CONFIRMED', now)) return null;

    const recent = this.motionBuf.slice(-FALL_LOOKBACK_SAMPLES);

    // Look for a free-fall phase (near-zero linear acceleration)
    const freeFallIdx = recent.findIndex(s => s.magnitude < FALL_FREE_FALL_MAG);
    if (freeFallIdx === -1) return null;

    // Verify an impact spike follows the free-fall phase
    const hasImpact = recent.slice(freeFallIdx).some(s => s.magnitude > FALL_IMPACT_MAG);
    if (!hasImpact) return null;

    const last = this.gpsBuf.at(-1);
    const lat  = last?.lat ?? 0;
    const lng  = last?.lng ?? 0;

    // Register as an internal fall event so checkFallConfirmed can also corroborate it
    this.lastFallEvent = { timestamp: now, lat, lng };

    return this.buildEvent('FALL_CONFIRMED', 'HIGH', 85, now);
  }

  // Detect extended immobility after a confirmed period of movement
  private checkProlongedImmobility(now: number): RiskEvent | null {
    if (this.movingState !== 'STOPPED')                        return null;
    if (this.lastMovingTime === 0)                             return null;
    if (this.lastMovingTime - this.movingStartTime < MIN_MOVING_DURATION) return null;
    if (now - this.lastMovingTime < IMMOBILITY_THRESHOLD)      return null;
    if (this.isOnCooldown('PROLONGED_IMMOBILITY', now))        return null;

    return this.buildEvent('PROLONGED_IMMOBILITY', 'MEDIUM', 55, now);
  }

  // Return true if the same pattern fired within the cooldown window
  private isOnCooldown(pattern: RiskPattern, now: number): boolean {
    const last = this.cooldowns.get(pattern) ?? 0;
    return now - last < COOLDOWN;
  }

  // Construct a RiskEvent, record the cooldown timestamp, and map i18n keys
  private buildEvent(pattern: RiskPattern, level: RiskLevel, score: number, now: number): RiskEvent {
    this.cooldowns.set(pattern, now);
    const last = this.gpsBuf.at(-1);
    const key  = I18N_KEY[pattern];

    return {
      id:           crypto.randomUUID(),
      pattern,
      level,
      score,
      detectedAt:   now,
      lat:          last?.lat ?? 0,
      lng:          last?.lng ?? 0,
      titleKey:     `risk.${key}.title`,
      descKey:      `risk.${key}.desc`,
      autoSOSDelay: level === 'HIGH' ? 30 : undefined,
    };
  }
}
