/*
 * RegionList.tsx
 * Renders the searchable list of preset and custom downloadable regions inside
 * DownloadMapScreen. Each row shows the download state (pending, in-progress,
 * or offline-available) and provides download, delete, and view actions that
 * bubble up via callbacks. Exports the Region interface used across the feature.
 */
import React from 'react';

export interface Region {
  id: number | string;
  name: string;
  detail: string;
  size?: string;
  bounds?: any;
}

interface RegionListProps {
  t: any;
  regions: Region[];
  downloadedIds: (string | number)[];
  downloadingId: string | number | null;
  progress: number;
  searchQuery?: string;
  onDownload: (id: string | number, name: string) => void;
  onDelete: (id: string | number, name: string) => void;
  onView: (id: string | number) => void;
}

export default function RegionList({
  t,
  regions,
  downloadedIds,
  downloadingId,
  progress,
  searchQuery = '',
  onDownload,
  onDelete,
  onView,
}: RegionListProps) {
  return (
    <section>
      <h3 className="text-eris-text-muted text-xs font-bold uppercase tracking-widest mb-3 px-2">
        {t('download.suggested', 'Suggested Regions')}
      </h3>

      <div className="flex flex-col gap-3">
        {regions.length > 0 ? (
          regions.map((region) => {
            // Get the actual state of the region
            const isDownloaded = downloadedIds.some((r) => String(r) === String(region.id));
            const isDownloadingThis = String(downloadingId) === String(region.id);
            const isCustom = typeof region.id === 'string' && region.id.startsWith('custom');
            const displaySize = isCustom ? t('download.customArea', 'Custom Area') : region.size || '';

            return (
              <div
                key={region.id}
                onClick={() => {
                  if (isDownloaded && !isDownloadingThis) {
                    onView(region.id);
                  }
                }}
                className={`bg-eris-surface-alt/40 border border-eris-border/50 rounded-3xl p-4 flex items-center justify-between shadow-sm transition-colors ${
                  isDownloaded && !isDownloadingThis ? 'cursor-pointer hover:bg-eris-surface-alt/60' : ''
                }`}
              >
                <div className="flex items-center gap-4">
                  {/* Icon */}
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 bg-gray-700/50 text-eris-text-muted">
                    <span className="material-symbols-outlined text-xl">
                      {isDownloaded ? 'offline_pin' : isCustom ? 'dashboard_customize' : 'location_city'}
                    </span>
                  </div>

                  {/* Region informations */}
                  <div>
                    <h4 className="text-eris-text text-sm font-bold mb-0.5">
                      {t(region.name)}
                      {!isCustom && <span className="text-eris-text-muted font-normal"> - {t(region.detail)}</span>}
                    </h4>
                    <p className="text-eris-text-subtle text-[11px] font-medium">
                      {isDownloadingThis
                        ? `${t('download.downloading', 'Downloading...')} ${progress}%`
                        : isDownloaded
                        ? t('download.available', 'Available Offline')
                        : `${displaySize}   ${t('download.mapData', 'Map & Navigation Data')}`}
                    </p>
                  </div>
                </div>

                {/* Actions (Télécharger / Chargement / Supprimer) */}
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  {isDownloadingThis ? (
                    <button
                      disabled
                      className="w-10 h-10 rounded-full flex items-center justify-center bg-eris-alert/20 text-eris-alert animate-pulse shrink-0"
                    >
                      <span className="material-symbols-outlined text-xl">sync</span>
                    </button>
                  ) : isDownloaded ? (
                    <button
                      onClick={() => onDelete(region.id, region.name)}
                      className="w-10 h-10 rounded-full flex items-center justify-center bg-eris-danger/10 text-eris-danger hover:bg-eris-danger/20 transition-all shrink-0"
                      title={t('offline.delete', 'Delete Zone')}
                    >
                      <span className="material-symbols-outlined text-xl">delete</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => onDownload(region.id, region.name)}
                      className="w-10 h-10 rounded-full flex items-center justify-center bg-eris-primary/10 text-eris-primary hover:bg-eris-primary/20 transition-all shrink-0"
                      title={t('download.confirmBtn', 'Download Zone')}
                    >
                      <span className="material-symbols-outlined text-xl">download</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          /* Empty state if no region correspond to the search */
          <div className="text-center py-6 text-eris-text-subtle text-sm">
            {t('download.noRegions', 'No regions found for')} "{searchQuery}"
          </div>
        )}
      </div>
    </section>
  );
}
