/*
 * LayerStylePicker.tsx
 * Component that renders a grid of selectable tile-style buttons (dark, light,
 * contrasted, satellite, etc.) sourced from MAP_STYLES in MapUtils. Used inside
 * DownloadMapScreen to let the user choose which tile styles to include in a
 * download. Highlights the active app theme as the default style.
 */
import React from 'react';
import { MAP_STYLES } from '../../../utils/MapUtils';

interface LayerStylePickerProps {
  t: any;
  selectedStyles: string[];
  toggleStyle: (id: string) => void;
  disabled: boolean;
}

export default function LayerStylePicker({ t, selectedStyles, toggleStyle, disabled }: LayerStylePickerProps) {
  const currentTheme = localStorage.getItem('eris_theme') || 'dark';
  const defaultStyleKey = currentTheme === 'light' ? 'light' : currentTheme === 'contrasted' ? 'contrasted' : 'dark';

  const sortedStyles = Object.entries(MAP_STYLES).sort(([keyA], [keyB]) => {
    if (keyA === defaultStyleKey) return -1;
    if (keyB === defaultStyleKey) return 1;
    return 0;
  });

  return (
    <section>
      <h3 className="text-eris-text-muted text-xs font-bold uppercase tracking-widest mb-3 px-2">
        {t('download.selectLayers', 'Select Map Layers')}
      </h3>

      {/* Style selection grid */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        {sortedStyles.map(([key, style]) => {
          const isSelected = selectedStyles.includes(key);

          return (
            <button
              key={key}
              onClick={() => toggleStyle(key)}
              disabled={disabled}
              className={`relative flex flex-col items-center justify-center gap-2 p-3 rounded-2xl border transition-all active:scale-95 ${
                isSelected
                  ? 'bg-eris-primary/20 border-eris-primary text-eris-primary'
                  : 'bg-eris-surface-alt/40 border-eris-border text-eris-text-subtle hover:bg-eris-surface-alt'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span className="material-symbols-outlined text-2xl">{style.icon}</span>
              <span className="text-xs font-bold">{t(`mapStyles.${key}`, style.name)}</span>

              {/* Validation icon */}
              {isSelected && (
                <div className="absolute top-2 right-2 w-4 h-4 bg-eris-primary rounded-full flex items-center justify-center">
                  <span className="material-symbols-outlined text-eris-text text-[10px] font-bold">check</span>
                </div>
              )}

              {/* Default badge for the actuel theme */}
              {key === defaultStyleKey && (
                <span className="text-[8px] uppercase font-black mt-0.5">{t('download.defaultStyle', 'Default')}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Storage alert message */}
      <div className="bg-eris-alert/10 border border-eris-alert/30 rounded-xl p-3 flex items-start gap-2">
        <span className="material-symbols-outlined text-eris-alert text-sm mt-0.5">database</span>
        <p className="text-eris-text-muted text-[10px] leading-relaxed">
          {t('download.storageWarning1', 'Selecting multiple layers increases storage usage.')}{' '}
          <span className="text-eris-text font-semibold">{t('download.satelliteTiles', 'Satellite tiles')}</span>{' '}
          {t('download.storageWarning2', 'are ~2.5x larger.')}
        </p>
      </div>
    </section>
  );
}
