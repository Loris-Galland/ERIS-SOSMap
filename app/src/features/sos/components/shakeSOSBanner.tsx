/*
 * Floating banner that appears at the bottom of the screen when a shake gesture triggers the SOS pipeline.
 * Exports the default ShakeSOSBanner component, rendered by the app shell while useShakeSOS is counting down.
 * Styled in eris-danger red with a bounce animation to signal urgency; includes a cancel button.
 * Connects to useShakeSOS and the i18n keys in the shake.* namespace.
 */
import { useTranslation } from 'react-i18next';

interface ShakeSOSBannerProps {
  isCounting: boolean;
  countdown: number;
  onCancel: () => void;
}

export default function ShakeSOSBanner({ isCounting, countdown, onCancel }: ShakeSOSBannerProps) {
  const { t } = useTranslation();

  if (!isCounting) return null;

  return (
    <div className="absolute bottom-24 left-4 right-4 bg-eris-danger/95 [.theme-contrasted_&]:bg-black backdrop-blur-md text-white p-4 rounded-2xl shadow-2xl z-[9999] flex flex-col gap-3 border border-white/20 [.theme-contrasted_&]:border-white animate-in fade-in slide-in-from-bottom-5 duration-300 animate-bounce">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined animate-spin text-xl">vibration</span>
          <span className="font-bold tracking-wide">
            {t('shake.banner_title', 'Sending SOS in {{seconds}}s', { seconds: countdown })}
          </span>
        </div>
        {/* Themed Badge */}
        <span className="text-[10px] bg-black/30 [.theme-contrasted_&]:bg-white [.theme-contrasted_&]:text-black px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
          {t('shake.banner_badge', 'Hardware Shake')}
        </span>
      </div>

      {/* Themed Cancel Button */}
      <button
        onClick={onCancel}
        className="w-full bg-white text-eris-danger [.theme-contrasted_&]:bg-white [.theme-contrasted_&]:text-black font-black py-2.5 rounded-xl text-xs hover:bg-gray-100 transition-colors active:scale-[0.98]"
      >
        {t('shake.banner_cancel', 'CANCEL DISPATCH')}
      </button>
    </div>
  );
}
