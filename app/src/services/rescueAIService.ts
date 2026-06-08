/*
 * rescueAIService — sends SOS alerts to the ERIS-RescueAI backend for AI processing.
 * POST /api/sos/ingest is called fire-and-forget by sosService on every internet-path
 * dispatch so RescueAI receives device_id, GPS position, and sensor flags for priority
 * scoring and deduplication.
 * GET /api/sos/events is available for future consumption (e.g. map overlays).
 * Base URL is read from VITE_RESCUE_AI_URL; if unset, all calls are silent no-ops.
 */

const BASE_URL = (import.meta.env.VITE_RESCUE_AI_URL as string | undefined)?.replace(/\/$/, '');

export interface RescueAISensorData {
  battery: number;
  fall_detected: boolean;
  crash_detected: boolean;
  inactivity_detected: boolean;
}

export interface RescueAIIngestPayload {
  device_id: string;
  lat: number;
  lng: number;
  sensor_data: RescueAISensorData;
}

export interface RescueAIEvent {
  id: string;
  device_id: string;
  lat: number;
  lng: number;
  sensor_data: RescueAISensorData;
  priority_score: number;
  is_duplicate: boolean;
  status: 'Pending' | 'In Progress' | 'Resolved';
  recommendation?: string;
  created_at: string;
}

export const ingestSOS = async (payload: RescueAIIngestPayload): Promise<void> => {
  if (!BASE_URL) return;
  await fetch(`${BASE_URL}/api/sos/ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
};

export const getEvents = async (): Promise<RescueAIEvent[]> => {
  if (!BASE_URL) return [];
  const res = await fetch(`${BASE_URL}/api/sos/events`);
  if (!res.ok) throw new Error(`RescueAI GET /api/sos/events returned ${res.status}`);
  return res.json();
};
