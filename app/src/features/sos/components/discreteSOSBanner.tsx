import { useTranslation } from 'react-i18next';

interface DiscreteSOSBannerProps {
  isCounting: boolean;
  countdown: number;
  onCancel: () => void;
}

export default function DiscreteSOSBanner({ isCounting, countdown, onCancel }: DiscreteSOSBannerProps) {
  const { t } = useTranslation();

  if (!isCounting) return null;

  return (
    <div className="absolute bottom-24 left-4 right-4 bg-eris-surface-alt/95 [.theme-contrasted_&]:bg-black backdrop-blur-md p-3 rounded-2xl shadow-2xl z-[9999] flex items-center justify-between border border-eris-border/50 [.theme-contrasted_&]:border-white [.theme-light_&]:shadow-lg animate-in fade-in slide-in-from-bottom-5 duration-300">
      <div className="flex items-center gap-3">
        {/* Themed Icon Circle */}
        <div className="w-8 h-8 rounded-full bg-eris-surface [.theme-contrasted_&]:bg-transparent [.theme-contrasted_&]:border [.theme-contrasted_&]:border-white flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-eris-text-subtle [.theme-contrasted_&]:text-white text-sm animate-pulse">
            visibility_off
          </span>
        </div>

        <div className="flex flex-col">
          <span className="text-sm font-bold text-eris-text [.theme-contrasted_&]:text-white">
            {t('discrete.banner_title', 'Silent SOS Triggered')}
          </span>
          <span className="text-xs text-eris-text-muted [.theme-contrasted_&]:text-gray-300 font-medium tracking-wide">
            {t('discrete.banner_subtitle', 'Sending in {{seconds}}s...', { seconds: countdown })}
          </span>
        </div>
      </div>

      {/* Themed Cancel Button */}
      <button
        onClick={onCancel}
        className="px-4 py-2 bg-eris-surface hover:bg-eris-surface-alt [.theme-contrasted_&]:bg-white [.theme-contrasted_&]:text-black text-eris-text text-xs font-bold rounded-xl transition-colors active:scale-95 border border-transparent [.theme-light_&]:border-eris-border/50"
      >
        {t('common.cancel', 'CANCEL')}
      </button>
    </div>
  );
}
