/*
 * Shared TypeScript types for the AI risk detection pipeline.
 * Used by the detection engine, the React hook, the UI banner, and the Dexie persistence layer.
 * The FallEventInput interface is the contract between this feature and the Auto Fall Detection feature.
 */

export type RiskPattern =
  | 'SUDDEN_STOP'           // high-speed movement collapses to a stop (vehicle accident)
  | 'FALL_CONFIRMED'        // GPS immobility corroborated by an accelerometer fall event
  | 'CRASH_CONFIRMED'       // high-speed accelerometer impact confirmed by useCrashDetection
  | 'PROLONGED_IMMOBILITY'; // user was moving, then stopped for an abnormally long time

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface PositionSample {
  lat: number;
  lng: number;
  alt: number;
  speed: number;     // m/s — native device speed preferred, Haversine-calculated as fallback
  timestamp: number; // ms since epoch
}

export interface MotionSample {
  ax: number;        // linear acceleration X m/s² (gravity removed)
  ay: number;        // linear acceleration Y m/s²
  az: number;        // linear acceleration Z m/s²
  magnitude: number; // sqrt(ax²+ay²+az²) — primary signal for fall phase detection
  timestamp: number;
}

// Contract for the Auto Fall Detection feature to feed events into the AI risk engine
export interface FallEventInput {
  timestamp: number;
  lat: number;
  lng: number;
}

export interface RiskEvent {
  id: string;
  pattern: RiskPattern;
  level: RiskLevel;
  score: number;         // 0–100 composite risk score
  detectedAt: number;
  lat: number;
  lng: number;
  titleKey: string;      // i18n key pointing to risk.<x>.title
  descKey: string;       // i18n key pointing to risk.<x>.desc
  autoSOSDelay?: number; // seconds before the banner auto-navigates to ALERTS (HIGH only)
}

// Stored in Dexie for audit history and post-incident review
export interface RiskEventRecord {
  id?: number;
  pattern: RiskPattern;
  level: RiskLevel;
  score: number;
  detectedAt: number;
  lat: number;
  lng: number;
  dismissed: boolean;
  sosSent: boolean;
}
