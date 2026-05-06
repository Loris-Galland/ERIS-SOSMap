import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PRESET_REGIONS } from '../../utils/MapUtils';
import AlertModal, { type AlertType } from '../../components/AlertModalProps';
import OfflineMapViewer from '../../components/OfflineMapViewer';
import { useDownloadManager } from './hooks/useDownloadManager';

function getRelativeTimeString(timestamp: number, t: any): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0)
    return t('offline.updatedDaysAgo', `Updated ${days} day${days > 1 ? 's' : ''} ago`).replace(
      '${days}',
      days.toString(),
    );
  if (hours > 0) return t('offline.updatedHoursAgo', `Updated ${hours}h ago`).replace('${hours}', hours.toString());
  if (minutes > 0)
    return t('offline.updatedMinsAgo', `Updated ${minutes} min ago`).replace('${minutes}', minutes.toString());
  return t('offline.updatedJustNow', 'Updated just now');
}

interface OfflineScreenProps {
  onBack: () => void;
  onNavigateDownload: () => void;
}

export default function OfflineScreen({ onBack, onNavigateDownload }: OfflineScreenProps) {
  const { t } = useTranslation();

  const [activeMenu, setActiveMenu] = useState<number | string | null>(null);
  const [viewingRegion, setViewingRegion] = useState<number | string | null>(null);

  const defaultDialogState = {
    isOpen: false,
    title: '',
    message: '',
    type: 'info' as AlertType,
    isConfirm: false,
    confirmText: '',
    onConfirm: () => {},
    onCancel: () => {},
  };
  const [dialog, setDialog] = useState(defaultDialogState);

  const closeDialog = () => setDialog((prev) => ({ ...prev, isOpen: false }));
  const openDialog = (options: Partial<typeof defaultDialogState>) => {
    setDialog({ ...defaultDialogState, ...options, isOpen: true });
  };
  const showAlert = (title: string, message: string, type: AlertType = 'info') => {
    openDialog({
      title,
      message,
      type,
      confirmText: 'OK',
      onConfirm: () => closeDialog(),
      onCancel: () => closeDialog(),
    });
  };

  // Hook manager integration
  const {
    updatingId,
    progress,
    downloadedRegions,
    customRegions,
    metadata,
    storageUsedMB,
    getBoundsForRegion,
    handleDelete,
    handleUpdate,
  } = useDownloadManager({ t, openDialog, closeDialog, showAlert });

  const MAX_STORAGE_MB = 1024;
  const progressPercent = Math.min((storageUsedMB / MAX_STORAGE_MB) * 100, 100);

  const getRegionInfo = (id: number | string) => {
    if (typeof id === 'number' || (typeof id === 'string' && !id.startsWith('custom_'))) {
      return PRESET_REGIONS.find((r) => r.id === Number(id));
    }
    return customRegions.find((r) => r.id === id);
  };

  return (
    <div className="flex flex-col h-full bg-eris-bg w-full overflow-y-auto font-sans relative pb-24">
      <AlertModal
        isOpen={dialog.isOpen}
        title={dialog.title}
        message={dialog.message}
        type={dialog.type}
        isConfirm={dialog.isConfirm}
        confirmText={dialog.confirmText}
        onConfirm={dialog.onConfirm}
        onCancel={closeDialog}
      />

      {/* Offline map viewer */}
      {viewingRegion !== null &&
        (() => {
          const bounds = getBoundsForRegion(viewingRegion);
          const regionInfo = getRegionInfo(viewingRegion);
          if (!bounds || !regionInfo) return null;

          return (
            <OfflineMapViewer
              name={regionInfo.name}
              bounds={bounds}
              onClose={() => setViewingRegion(null)}
              availableStyles={metadata[viewingRegion]?.styles}
            />
          );
        })()}

      {/* HEADER */}
      <header className="flex items-center px-6 py-4 bg-eris-bg/90 backdrop-blur-md sticky top-[-2px] z-50">
        <button
          onClick={onBack}
          className="text-eris-text-muted hover:text-eris-text transition-colors mr-4 active:scale-95 flex items-center justify-center w-10 h-10 bg-eris-surface-alt/50 rounded-full"
        >
          <span className="material-symbols-outlined">chevron_left</span>
        </button>
        <h2 className="text-eris-text text-xl font-bold tracking-wide">{t('offline.title', 'Offline Maps')}</h2>
      </header>

      <div className="p-4 flex-1 flex flex-col gap-6">
        {/* ─── STORAGE CARD ─── */}
        <div className="bg-gradient-to-br from-eris-primary/30 to-gray-800/40 border border-eris-primary/20 rounded-3xl p-5 shadow-lg relative overflow-hidden">
          {storageUsedMB === 0 && <div className="absolute inset-0 bg-eris-primary/5 animate-pulse rounded-3xl" />}

          <div className="flex justify-between items-end mb-4 relative z-10">
            <div>
              <p className="text-eris-text-muted text-xs font-semibold uppercase tracking-wider mb-1">
                {t('offline.localStorage', 'Local Storage')}
              </p>
              <h3 className="text-eris-text text-3xl font-bold">
                {storageUsedMB}{' '}
                <span className="text-eris-text-muted text-sm font-normal">{t('offline.mbUsed', 'MB used')}</span>
              </h3>
            </div>
            <span className="text-eris-text-subtle text-sm font-medium bg-eris-surface/50 px-3 py-1 rounded-lg">
              {t('offline.gbTotal', '1.0 GB Total')}
            </span>
          </div>

          <div className="w-full h-3 bg-eris-surface rounded-full overflow-hidden border border-eris-border/50 relative z-10">
            <div
              className={`h-full bg-eris-primary rounded-full shadow-[0_0_10px_rgba(59,130,246,0.6)] transition-all duration-1000 ease-out`}
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>

          {/* Warning message for when the storage is almost full */}
          {progressPercent > 90 && (
            <p className="text-eris-danger text-[11px] font-medium mt-3 flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">warning</span>
              {t('offline.storageWarning', 'Storage is almost full. Consider deleting old maps.')}
            </p>
          )}
        </div>

        {/* ─── REGIONAL MAPS LIST ─── */}
        <section>
          <h3 className="text-eris-text-muted text-xs font-bold uppercase tracking-widest mb-3 px-2">
            {t('offline.myRegions', 'My Regions')}
          </h3>

          <div className="flex flex-col gap-3">
            {downloadedRegions.length > 0 ? (
              downloadedRegions.map((id) => {
                const info = getRegionInfo(id);
                if (!info) return null;
                const lastUpdate = metadata[id]?.lastUpdate;
                const isUpdating = updatingId === id;

                return (
                  <div
                    key={id}
                    onClick={() => {
                      if (!isUpdating) setViewingRegion(id);
                    }}
                    className="bg-eris-surface-alt/40 border border-eris-border/50 rounded-3xl p-4 flex items-center justify-between shadow-sm cursor-pointer hover:bg-eris-surface-alt/60 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 bg-eris-success/10 text-eris-success">
                        <span className="material-symbols-outlined text-xl">{isUpdating ? 'sync' : 'offline_pin'}</span>
                      </div>
                      <div>
                        <h4 className="text-eris-text text-sm font-bold mb-0.5">{info.name}</h4>
                        <p className="text-eris-text-subtle text-[11px] font-medium">
                          {isUpdating
                            ? `${t('download.downloading', 'Updating...')} ${progress}%`
                            : lastUpdate
                              ? getRelativeTimeString(lastUpdate, t)
                              : t('offline.unknownDate', 'Unknown Date')}
                          {info.size ? ` • ${info.size}` : ''}
                        </p>
                      </div>
                    </div>

                    {/* Action menu */}
                    {!isUpdating && (
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenu(activeMenu === id ? null : id);
                          }}
                          className="text-eris-text-subtle hover:text-eris-text transition-colors w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-700/30"
                        >
                          <span className="material-symbols-outlined">more_vert</span>
                        </button>

                        {activeMenu === id && (
                          <div className="absolute right-0 mt-2 w-36 bg-eris-surface border border-eris-border rounded-2xl shadow-2xl z-[3000] overflow-hidden animate-in fade-in zoom-in duration-150">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenu(null);
                                handleUpdate(id, info.name);
                              }}
                              className="w-full px-4 py-3 text-left text-xs font-bold text-eris-primary hover:bg-eris-surface-alt flex items-center gap-2 border-b border-eris-border"
                            >
                              <span className="material-symbols-outlined text-sm">update</span>{' '}
                              {t('offline.update', 'Update')}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenu(null);
                                handleDelete(id, info.name);
                              }}
                              className="w-full px-4 py-3 text-left text-xs font-bold text-eris-danger hover:bg-eris-surface-alt flex items-center gap-2"
                            >
                              <span className="material-symbols-outlined text-sm">delete</span>{' '}
                              {t('offline.delete', 'Delete')}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              /* If no map is downloaded */
              <div className="bg-eris-surface-alt/20 border border-dashed border-eris-border/50 rounded-3xl p-8 flex flex-col items-center justify-center text-center">
                <span className="material-symbols-outlined text-gray-600 text-4xl mb-3">cloud_off</span>
                <p className="text-eris-text-subtle text-sm">{t('offline.noMapsFound', 'No offline maps found.')}</p>
                <p className="text-gray-600 text-[11px] mt-1">
                  {t('offline.downloadPrompt', 'Download a region to use the app without internet.')}
                </p>
              </div>
            )}
          </div>
        </section>

        {/* ─── DOWNLOAD NEW MAP BUTTON ─── */}
        <div className="sticky bottom-[-97px] pt-4 pb-2 bg-eris-bg/90 backdrop-blur-md border-t border-eris-border/50 mt-auto z-40 -mx-4 px-4">
          <button
            onClick={onNavigateDownload}
            className="w-full py-4 bg-eris-primary text-eris-text rounded-3xl text-sm font-bold tracking-wide flex items-center justify-center gap-2 shadow-lg shadow-eris-primary/30 hover:bg-eris-primary transition-all active:scale-95"
          >
            <span className="material-symbols-outlined">add_location</span>
            {t('offline.downloadNewRegion', 'Download New Region')}
          </button>
        </div>

        <p className="text-eris-text-subtle text-[11px] text-center mt-4 px-4 leading-relaxed">
          {t(
            'offline.downloadInfo',
            'Downloading maps allows you to navigate and use the ERIS emergency network even without internet access.',
          )}
        </p>
      </div>
    </div>
  );
}
