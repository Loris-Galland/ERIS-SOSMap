/**
 * DiagnosticsSection.tsx
 * Displays the current status of physical components (LoRa, Mesh)
 */
import React from 'react';
import { useTranslation } from 'react-i18next';

export default function DiagnosticsSection() {
  const { t } = useTranslation();

  return (
    <section>
      <h3 className="text-eris-text-muted text-xs font-bold uppercase tracking-widest mb-3 px-2">
        {t('settings.diagnosticsTitle', 'System Diagnostics')}
      </h3>
      <div className="bg-eris-surface-alt/40 border border-eris-border/50 rounded-3xl p-5 flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <span className="text-eris-text-muted text-sm">{t('diagnostics.loraModule', 'LoRa Module')}</span>
          <span className="flex items-center gap-2 text-eris-success text-xs font-bold bg-eris-success/10 px-3 py-1 rounded-full">
            <span className="w-1.5 h-1.5 bg-eris-success rounded-full animate-pulse"></span>{' '}
            {t('settings.connected', 'Connected')}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-eris-text-muted text-sm">{t('diagnostics.meshNetwork', 'Mesh Network')}</span>
          <span className="text-eris-primary text-xs font-bold bg-eris-primary/10 px-3 py-1 rounded-full">
            {t('settings.searching', 'Searching...')}
          </span>
        </div>
        <button className="mt-2 w-full py-3 bg-gray-700/50 text-eris-text text-xs font-bold rounded-2xl border border-gray-600/50 hover:bg-gray-700 transition-colors active:scale-95">
          {t('settings.runTest', 'Run Network Test')}
        </button>
      </div>
    </section>
  );
}
