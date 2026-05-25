/*
 * React hook that feeds GPS position data into RiskDetectionEngine
 * and exposes a RiskEvent whenever a dangerous behavioral pattern is detected.
 * Physical fall/crash detection (accelerometer) feeds corroboration events
 * into this hook via riskEventBus, keeping the two features decoupled.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';
import { db } from '../../../db/localDb';
import { RiskDetectionEngine } from '../riskDetectionEngine';
import { riskEventBus } from '../riskEventBus';
import type { PositionSample, RiskEvent } from '../types';

export function useRiskDetection(userId: string | null) {
  const engineRef                           = useRef(new RiskDetectionEngine());
  const [riskEvent, setRiskEvent]           = useState<RiskEvent | null>(null);
  const [currentSpeedMs, setCurrentSpeedMs] = useState(0);
  const lastPositionRef                     = useRef<PositionSample | null>(null);

  // GPS watcher at low frequency — feeds behavioral (not real-time) position analysis
  useEffect(() => {
    let watchId: string | null = null;

    const startGpsWatch = async () => {
      try {
        if (Capacitor.isNativePlatform()) {
          await Geolocation.requestPermissions();
        }

        watchId = await Geolocation.watchPosition(
          { enableHighAccuracy: false, timeout: 20_000, maximumAge: 8_000 },
          (position, err) => {
            if (err) { console.warn('[RISK] GPS error', err); return; }
            if (!position) return;

            const { latitude, longitude, altitude, speed } = position.coords;
            const sample: PositionSample = {
              lat:       latitude,
              lng:       longitude,
              alt:       altitude ?? 0,
              speed:     speed != null && speed >= 0 ? speed : deriveSpeed(lastPositionRef.current, latitude, longitude),
              timestamp: Date.now(),
            };

            lastPositionRef.current = sample;
            setCurrentSpeedMs(sample.speed);
            const event = engineRef.current.addGpsSample(sample);
            if (event) setRiskEvent(prev => scoreOf(prev) >= scoreOf(event) ? prev : event);
          },
        );
      } catch (err) {
        console.warn('[RISK] GPS watcher failed to start', err);
      }
    };

    startGpsWatch();
    return () => { if (watchId) Geolocation.clearWatch({ id: watchId }); };
  }, []);

  // Register bus handlers so fall and crash detectors can feed events into the AI engine
  useEffect(() => {
    riskEventBus.onFallDetected((lat, lng) => {
      engineRef.current.reportFallEvent({ timestamp: Date.now(), lat, lng });
    });
    riskEventBus.onCrashDetected((lat, lng) => {
      // Crash fires immediately — speed-arming already provides high confidence
      const event = engineRef.current.reportCrashEvent({ timestamp: Date.now(), lat, lng });
      if (event) setRiskEvent(prev => scoreOf(prev) >= scoreOf(event) ? prev : event);
    });
    return () => riskEventBus.clearHandlers();
  }, []);

  // Dismiss the alert and persist the dismissal to Dexie for audit history
  const dismissRisk = useCallback(async () => {
    if (!riskEvent) return;
    try {
      await db.riskEvents.add({ ...riskEvent, dismissed: true, sosSent: false, id: undefined });
    } catch (err) {
      console.warn('[RISK] Could not persist dismissed event', err);
    }
    setRiskEvent(null);
  }, [riskEvent]);

  // Mark the event as resolved via SOS and persist it
  const acknowledgeAsSOS = useCallback(async () => {
    if (!riskEvent) return;
    try {
      await db.riskEvents.add({ ...riskEvent, dismissed: false, sosSent: true, id: undefined });
    } catch (err) {
      console.warn('[RISK] Could not persist SOS event', err);
    }
    setRiskEvent(null);
  }, [riskEvent]);

  return { riskEvent, dismissRisk, acknowledgeAsSOS, currentSpeedMs };
}

// Prefer the event with the higher score to avoid overwriting a severe alert
function scoreOf(event: RiskEvent | null): number {
  return event?.score ?? -1;
}

// Calculate speed in m/s from two consecutive GPS positions using Haversine distance
function deriveSpeed(prev: PositionSample | null, lat: number, lng: number): number {
  if (!prev) return 0;
  const dt = (Date.now() - prev.timestamp) / 1000;
  if (dt <= 0 || dt > 60) return 0;
  const d = haversineMeters(prev.lat, prev.lng, lat, lng);
  const speed = d / dt;
  return isFinite(speed) ? Math.min(speed, 300) : 0;
}

// Return the great-circle distance in metres between two GPS coordinates
function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R    = 6_371_000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a    = Math.sin(dLat / 2) ** 2 +
               Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}
