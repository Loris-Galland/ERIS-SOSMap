/*
 * Floating badge shown whenever an emergency audio recording is in progress.
 * Mounted in App.tsx so it stays visible across all tabs.
 * pointer-events-none ensures it never intercepts user taps.
 */

import { useTranslation } from 'react-i18next';

interface RecordingIndicatorProps {
  isRecording: boolean;
}

export default function RecordingIndicator({ isRecording }: RecordingIndicatorProps) {
  const { t } = useTranslation();

  if (!isRecording) return null;

  return (
    <div className="fixed top-16 right-4 z-[9998] flex items-center gap-1.5 bg-eris-danger/90 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-lg pointer-events-none animate-in fade-in duration-300">
      <span className="w-2 h-2 rounded-full bg-white animate-pulse shrink-0" />
      <span className="text-white text-[11px] font-black tracking-widest uppercase">
        {t('audio.recBadge', 'REC')}
      </span>
    </div>
  );
}
