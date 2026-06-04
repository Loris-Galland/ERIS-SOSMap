/*
 * Admin screen listing all emergency audio recordings stored in Supabase.
 * Each card shows the trigger type (fall / crash), duration, recording date,
 * and an inline <audio> player backed by a 1-hour signed URL.
 * Admins can also download the file or delete the metadata row + storage object.
 */

import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAudioRecordings } from '../hooks/useAudioRecordings';
import { supabase } from '../../../db/supabaseClient';
import type { AudioRecordingAdmin } from '../hooks/useAudioRecordings';

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Recording card ──────────────────────────────────────────────────────────

interface RecordingCardProps {
  recording: AudioRecordingAdmin;
  onDeleted: (id: string) => void;
  onViewAlert?: (alertId: string) => void;
}

function RecordingCard({ recording, onDeleted, onViewAlert }: RecordingCardProps) {
  const { t } = useTranslation();
  const [deleting, setDeleting] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  let iconName = 'mic';
  let iconColor = 'text-eris-text-muted';
  let title: string = recording.trigger_type;

  if (recording.trigger_type === 'fall') {
    iconName = 'personal_injury';
    iconColor = 'text-eris-alert';
    title = t('admin.audio.triggerFall', 'Fall Detected');
  } else if (recording.trigger_type === 'crash') {
    iconName = 'car_crash';
    iconColor = 'text-eris-danger';
    title = t('admin.audio.triggerCrash', 'Crash Detected');
  } else if (recording.trigger_type === 'shake') {
    iconName = 'vibration';
    iconColor = 'text-orange-500';
    title = t('admin.audio.triggerShake', 'Shake Detected');
  } else if (recording.trigger_type === 'discrete') {
    iconName = 'visibility_off';
    iconColor = 'text-purple-500';
    title = t('admin.audio.triggerDiscrete', 'Discrete SOS');
  }

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation(); // don't expand the card
    if (!audioRef.current || !recording.signedUrl) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  };

  const handleDelete = async () => {
    if (!confirm(t('admin.audio.confirmDelete', 'Delete this recording permanently?'))) return;
    setDeleting(true);
    await supabase.storage.from('emergency_recordings').remove([recording.file_path]);
    await supabase.from('emergency_recordings').delete().eq('id', recording.id);
    onDeleted(recording.id);
  };

  return (
    <div
      className={`border rounded-2xl transition-all duration-300 ${expanded ? 'border-eris-primary/50' : 'border-eris-border/50'}`}
    >
      {/* Hidden audio element controlled by the play button */}
      {recording.signedUrl && (
        <audio
          ref={audioRef}
          src={recording.signedUrl}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
        />
      )}

      {/* Header row */}
      <div
        className={`p-4 flex items-center gap-3 rounded-t-2xl ${expanded ? 'bg-eris-surface-alt/40 rounded-b-none' : 'bg-eris-surface rounded-2xl'}`}
      >
        <div className="w-8 h-8 rounded-full flex items-center justify-center bg-eris-bg border border-eris-border/40 shrink-0">
          <span
            className={`material-symbols-outlined text-base ${iconColor}`}
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            {iconName}
          </span>
        </div>

        <button className="flex-1 min-w-0 text-left" onClick={() => setExpanded((v) => !v)}>
          <p className="font-semibold text-sm text-eris-text">{title}</p>
          <p className="text-eris-text-muted text-xs mt-0.5">
            {formatDate(recording.created_at)} — {formatDuration(recording.duration_seconds)}
          </p>
        </button>

        {recording.signedUrl && (
          <button
            onClick={togglePlay}
            className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all active:scale-90 ${
              playing
                ? 'bg-eris-primary text-white shadow-md'
                : 'bg-eris-bg border border-eris-border/50 text-eris-text-muted'
            }`}
          >
            <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>
              {playing ? 'pause' : 'play_arrow'}
            </span>
          </button>
        )}

        <button onClick={() => setExpanded((v) => !v)} className="shrink-0 pl-1">
          <span
            className={`material-symbols-outlined text-eris-text-subtle text-lg transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}
          >
            expand_more
          </span>
        </button>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 pt-3 bg-eris-surface rounded-b-2xl border-t border-eris-border/30 flex flex-col gap-3 animate-in fade-in slide-in-from-top-1 duration-200">
          <p className="text-eris-text-subtle text-[11px] font-mono truncate">
            {t('admin.audio.userId', 'User:')} {recording.user_id}
          </p>
          <p className="text-eris-text-subtle text-[11px]">
            {t('admin.audio.expiresAt', 'Expires:')} {formatDate(recording.expires_at)}
          </p>
          <div className="flex gap-2">
            {recording.signedUrl && (
              <a
                href={recording.signedUrl}
                download
                className="flex-1 flex items-center justify-center gap-2 bg-eris-primary/10 border border-eris-primary/30 text-eris-primary text-xs font-bold py-2.5 rounded-xl active:scale-95 transition-all"
              >
                <span className="material-symbols-outlined text-[16px]">download</span>
                {t('admin.audio.download', 'Download')}
              </a>
            )}
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex-1 flex items-center justify-center gap-2 bg-eris-danger/10 border border-eris-danger/30 text-eris-danger text-xs font-bold py-2.5 rounded-xl active:scale-95 transition-all disabled:opacity-50"
            >
              {deleting ? (
                <span className="material-symbols-outlined animate-spin text-[16px]">sync</span>
              ) : (
                <span className="material-symbols-outlined text-[16px]">delete</span>
              )}
              {t('admin.audio.delete', 'Delete')}
            </button>
          </div>

          {recording.alert_id && onViewAlert && (
            <button
              onClick={() => onViewAlert(recording.alert_id!)}
              className="w-full mt-1 flex items-center justify-center gap-2 bg-eris-alert/10 border border-eris-alert/30 text-eris-alert text-xs font-bold py-2.5 rounded-xl active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-[16px]">link</span>
              {t('admin.audio.viewAlert', 'View Linked SOS Alert')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main dashboard ──────────────────────────────────────────────────────────

interface AudioRecordingsDashboardProps {
  onBack: () => void;
  onViewAlert?: (alertId: string) => void;
}

export default function AudioRecordingsDashboard({ onBack, onViewAlert }: AudioRecordingsDashboardProps) {
  const { t } = useTranslation();
  const { recordings, loading, error, refetch } = useAudioRecordings();
  // Track optimistically deleted IDs so the card disappears immediately
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const visibleList = recordings.filter((r) => !deletedIds.has(r.id));

  const handleDeleted = (id: string) => setDeletedIds((prev) => new Set([...prev, id]));

  return (
    <div className="flex flex-col absolute inset-0 bg-eris-bg text-eris-text overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-eris-border/50 bg-eris-bg/80 backdrop-blur-md z-10 shrink-0">
        <button
          onClick={onBack}
          className="w-9 h-9 flex items-center justify-center bg-eris-surface rounded-full active:scale-90 transition-transform shadow-sm"
        >
          <span className="material-symbols-outlined text-xl">arrow_back</span>
        </button>
        <div className="flex-1">
          <h2 className="font-bold text-base">{t('admin.audio.title', 'Audio Recordings')}</h2>
          <p className="text-eris-text-muted text-[11px] font-medium">
            {loading
              ? t('admin.loading', 'Loading...')
              : t('admin.audio.stats', '{{count}} recording(s)', { count: visibleList.length })}
          </p>
        </div>
        <button
          onClick={refetch}
          className="w-9 h-9 flex items-center justify-center bg-eris-surface rounded-full active:scale-90 transition-transform shadow-sm"
        >
          <span className={`material-symbols-outlined text-xl ${loading ? 'animate-spin' : ''}`}>refresh</span>
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
        {loading && visibleList.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <span className="material-symbols-outlined animate-spin text-eris-primary text-4xl">sync</span>
            <p className="text-eris-text-muted text-sm font-medium">{t('admin.loading', 'Loading...')}</p>
          </div>
        )}

        {error && (
          <div className="bg-eris-danger/10 border border-eris-danger/30 rounded-2xl p-4 text-eris-danger text-sm flex items-center gap-3">
            <span className="material-symbols-outlined">error</span>
            {error}
          </div>
        )}

        {!loading && visibleList.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 opacity-60">
            <span className="material-symbols-outlined text-eris-text-subtle text-5xl">mic_off</span>
            <p className="text-eris-text-muted text-sm font-medium">
              {t('admin.audio.noRecordings', 'No recordings yet')}
            </p>
          </div>
        )}

        {visibleList.map((rec) => (
          <RecordingCard key={rec.id} recording={rec} onDeleted={handleDeleted} onViewAlert={onViewAlert} />
        ))}

        <div className="h-10 shrink-0" />
      </div>
    </div>
  );
}
