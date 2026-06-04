/*
 * useAudioRecording — hook that owns the full MediaRecorder lifecycle for
 * emergency audio capture triggered by fall or crash detection.
 * Guards all actions behind the RGPD opt-in flag stored in localStorage.
 * Exposes startRecording(triggerType), stopRecording(), and cancelRecording().
 * On stop it delegates the upload to audioUploadService, which handles both
 * online upload to Supabase Storage and offline queuing via Dexie.
 * An auto-stop timer enforces a 5-minute recording ceiling.
 */

import { useCallback, useRef, useState, useEffect } from 'react';
import { VoiceRecorder } from 'capacitor-voice-recorder';
import { uploadAudio } from '../services/audioUploadService';

const MAX_DURATION_S  = 300;                    // 5-minute ceiling per recording
//const PREFERRED_MIME  = 'audio/webm;codecs=opus';
//const FALLBACK_MIME   = 'audio/mp4';

export type TriggerType = 'fall' | 'crash' | 'manual' | 'discrete' | 'shake';

// Helper function to convert the native Base64 audio into a Blob for Supabase
const base64ToBlob = (base64: string, mimeType: string) => {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
};

let globalIsRecording = false;
let globalStopTimer: ReturnType<typeof setTimeout> | null = null;
let globalStartTime: number = 0;
let globalTriggerType: TriggerType | null = null;
let globalAlertId: string | null = null;
let globalUserId: string | null = null;

// Subscribers list to keep the UI 'isRecording' state in sync across all pages
const subscribers = new Set<(isRec: boolean) => void>();

const notifySubscribers = (isRec: boolean) => {
  globalIsRecording = isRec;
  subscribers.forEach(sub => sub(isRec));
};

export function useAudioRecording(userId: string | null) {
  const [isRecording, setIsRecording]   = useState(false);

  useEffect(() => {
    subscribers.add(setIsRecording);
    return () => { subscribers.delete(setIsRecording); };
  }, []);

  const linkAudioToAlert = useCallback((alertId: string) => {
    globalAlertId = alertId;
  }, [])

    // Finalise and upload
  const stopRecording = useCallback(async () => {
    alert("🛑 STOP RECORDING WAS JUST TRIGGERED!");
    
    if (globalStopTimer) clearTimeout(globalStopTimer);
    
    try {
      // Stop the native recorder
      const result = await VoiceRecorder.stopRecording();
      notifySubscribers(false);

      // If we have audio data, upload it
      if (result.value && result.value.recordDataBase64) {
        const durationSeconds = Math.round((Date.now() - globalStartTime) / 1000);
        
        // Convert the native Base64 payload into a standard Blob
        const blob = base64ToBlob(result.value.recordDataBase64, result.value.mimeType);

        if (globalTriggerType && globalUserId) {
          await uploadAudio({ 
            blob, 
            userId: globalUserId, 
            triggerType: globalTriggerType, 
            durationSeconds,
            alertId: globalAlertId 
          });
        }
      }
    } catch (err) {
      console.warn(`[AUDIO] Upload Error:`, err);
    } finally {
      // Clean up globals for the next emergency
      globalTriggerType = null;
      globalAlertId = null;
    }
  }, []);

  const startRecording = useCallback(async (triggerType: TriggerType) => {
    if (globalIsRecording) return;
    
    // Check consent to record audio globally
    const isMasterEnabled = localStorage.getItem('eris_audio_recording_enabled') === 'true';
    if (!isMasterEnabled) return;

    // Check preferences per sos type
    try {
      const recordingPrefsRaw = localStorage.getItem('eris_audio_prefs');
      if (recordingPrefsRaw) {
        const recordingPrefs = JSON.parse(recordingPrefsRaw);
        // If this specific trigger type was explicitly toggled off by the user, abort.
        if (recordingPrefs[triggerType] === false) {
          console.log(`[AUDIO] Bypassed for ${triggerType} SOS. Disabled in granular settings.`);
          return;
        }
      }
    } catch (e) {
      console.warn('[AUDIO] Failed to parse granular audio preferences, defaulting to enabled', e);
    }

    try {
      // Check Native Permissions
      const hasPermission = await VoiceRecorder.hasAudioRecordingPermission();
      if (!hasPermission.value) {
        const request = await VoiceRecorder.requestAudioRecordingPermission();
        if (!request.value) {
          console.log("[AUDIO] Microphone permission denied by Android.");
          return;
        }
      }

      // Set the global variables so they survive navigation
      globalTriggerType = triggerType;
      globalUserId = userId; 
      globalAlertId = null;

      await VoiceRecorder.startRecording();
      
      globalStartTime = Date.now();
      notifySubscribers(true);

      // Start the 5-minute background countdown
      globalStopTimer = setTimeout(() => stopRecording(), MAX_DURATION_S * 1_000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : JSON.stringify(err);
      alert(`Audio Start Error: ${errorMessage}`);
    }
  }, [userId, stopRecording]);

  // Abort and discard — used when the user confirms "I'm fine" after a false alarm
  const cancelRecording = useCallback(async () => {
    alert("⚠️ CANCEL RECORDING WAS JUST TRIGGERED!");
    if (globalStopTimer) clearTimeout(globalStopTimer);
    try {
      // Stop and immediately discard the file
      await VoiceRecorder.stopRecording(); 
      notifySubscribers(false);
      globalTriggerType = null;
      globalAlertId = null;
    } catch (e) {
      console.warn('[AUDIO] Cancel recording failed', e);
    }
  }, []);

  return { isRecording, startRecording, stopRecording, cancelRecording, linkAudioToAlert};
}
