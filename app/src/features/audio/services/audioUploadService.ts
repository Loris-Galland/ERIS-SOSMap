/*
 * Handles uploading emergency audio recordings to Supabase Storage.
 * Upload path: emergency-recordings/<user_id>/<trigger>_<timestamp>.webm
 *
 * Offline fallback: if the upload fails for any reason (no connectivity,
 * storage quota, etc.) the blob and its metadata are persisted to the
 * Dexie pendingAudioUploads table. The next successful upload attempt
 * triggers flushPendingUploads() to drain the local queue.
 *
 * Retry limit: 3 attempts per record before it is abandoned to avoid
 * filling IndexedDB indefinitely.
 */

import { supabase } from '../../../db/supabaseClient';
import { db } from '../../../db/localDb';
import type { TriggerType } from '../hooks/useAudioRecording';

const BUCKET         = 'emergency_recordings';
const RETENTION_DAYS = 30;
const MAX_RETRIES    = 3;

interface UploadParams {
  blob: Blob;
  userId: string;
  triggerType: TriggerType;
  durationSeconds: number;
}

// Entry point — attempts an upload, queues locally on failure
export async function uploadAudio(params: UploadParams): Promise<void> {
  try {
    await attemptUpload(params);
    // Back online: drain any queued recordings in the background
    flushPendingUploads(params.userId).catch(() => {});
  } catch {
    console.warn('[AUDIO] Upload failed — saving locally for retry');
    await db.pendingAudioUploads.add({
      user_id:          params.userId,
      trigger_type:     params.triggerType,
      blob:             params.blob,
      duration_seconds: params.durationSeconds,
      created_at:       Date.now(),
      retry_count:      0,
    });
  }
}

// Send the blob to Supabase Storage and insert the metadata row
async function attemptUpload({ blob, userId, triggerType, durationSeconds }: UploadParams): Promise<void> {
  const fileName  = `${userId}/${triggerType}_${Date.now()}.webm`;
  const expiresAt = new Date(Date.now() + RETENTION_DAYS * 24 * 60 * 60 * 1_000).toISOString();

  // Strip codec parameters — Supabase Storage rejects MIME types with semicolons (e.g. audio/webm;codecs=opus)
  const contentType = blob.type.split(';')[0] || 'audio/webm';

  const { error: storageError } = await supabase.storage
    .from(BUCKET)
    .upload(fileName, blob, { contentType, upsert: false });

  if (storageError) throw storageError;

  const { error: dbError } = await supabase
    .from('emergency_recordings')
    .insert({ user_id: userId, trigger_type: triggerType, file_path: fileName, duration_seconds: durationSeconds, expires_at: expiresAt });

  if (dbError) {
    // Remove orphaned storage file if the metadata insert failed
    await supabase.storage.from(BUCKET).remove([fileName]);
    throw dbError;
  }
}

// Retry locally queued recordings — called in the background whenever a live upload succeeds
export async function flushPendingUploads(userId: string): Promise<void> {
  const pending = await db.pendingAudioUploads
    .where('user_id').equals(userId)
    .filter((r) => r.retry_count < MAX_RETRIES)
    .toArray();

  for (const record of pending) {
    try {
      await attemptUpload({
        blob:             record.blob,
        userId:           record.user_id,
        triggerType:      record.trigger_type,
        durationSeconds:  record.duration_seconds,
      });
      await db.pendingAudioUploads.delete(record.id!);
    } catch {
      await db.pendingAudioUploads.update(record.id!, { retry_count: record.retry_count + 1 });
    }
  }
}
