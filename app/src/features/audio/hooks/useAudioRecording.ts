/*
 * useAudioRecording — hook that owns the full MediaRecorder lifecycle for
 * emergency audio capture triggered by fall or crash detection.
 * Guards all actions behind the RGPD opt-in flag stored in localStorage.
 * Exposes startRecording(triggerType), stopRecording(), and cancelRecording().
 * On stop it delegates the upload to audioUploadService, which handles both
 * online upload to Supabase Storage and offline queuing via Dexie.
 * An auto-stop timer enforces a 5-minute recording ceiling.
 */

import { useCallback, useRef, useState } from 'react';
import { uploadAudio } from '../services/audioUploadService';

const MAX_DURATION_S  = 300;                    // 5-minute ceiling per recording
const PREFERRED_MIME  = 'audio/webm;codecs=opus';
const FALLBACK_MIME   = 'audio/mp4';

export type TriggerType = 'fall' | 'crash';

export function useAudioRecording(userId: string | null) {
  const [isRecording, setIsRecording]   = useState(false);
  const recorderRef                     = useRef<MediaRecorder | null>(null);
  const chunksRef                       = useRef<Blob[]>([]);
  const stopTimerRef                    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTimeRef                    = useRef<number>(0);
  const isCancelledRef                  = useRef(false);
  const streamRef                       = useRef<MediaStream | null>(null);

  // Release the microphone and clear the auto-stop timer
  const cleanup = () => {
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const startRecording = useCallback(async (triggerType: TriggerType) => {
    const isEnabled = localStorage.getItem('eris_audio_recording_enabled') === 'true';
    if (!isEnabled || !userId) return;
    // Avoid starting a second recorder while one is already active
    if (recorderRef.current?.state === 'recording') return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported(PREFERRED_MIME)
        ? PREFERRED_MIME
        : FALLBACK_MIME;

      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current    = [];
      isCancelledRef.current = false;
      startTimeRef.current = Date.now();

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        cleanup();
        setIsRecording(false);

        // User cancelled — discard without uploading
        if (isCancelledRef.current) {
          isCancelledRef.current = false;
          chunksRef.current = [];
          return;
        }

        const durationSeconds = Math.round((Date.now() - startTimeRef.current) / 1000);
        const blob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];

        // Hand off to upload service — handles both online and offline cases
        await uploadAudio({ blob, userId: userId!, triggerType, durationSeconds });
      };

      // Collect chunks every second for a responsive onstop callback
      recorder.start(1_000);
      recorderRef.current = recorder;
      setIsRecording(true);

      // Auto-stop guard
      stopTimerRef.current = setTimeout(() => stopRecording(), MAX_DURATION_S * 1_000);
    } catch (err) {
      // NotAllowedError = mic permission denied — fail silently, the SOS still works
      console.warn('[AUDIO] Could not start recording:', err);
    }
  }, [userId]);

  // Finalise and upload
  const stopRecording = useCallback(() => {
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop();
    }
  }, []);

  // Abort and discard — used when the user confirms "I'm fine" after a false alarm
  const cancelRecording = useCallback(() => {
    isCancelledRef.current = true;
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop();
    }
  }, []);

  return { isRecording, startRecording, stopRecording, cancelRecording };
}
