/*
 * DownloadMapScreen.tsx
 * Main screen for downloading offline map tiles. Lets users pick one or more
 * tile styles, search or draw a custom bounding box, and trigger a tile download
 * via leaflet.offline. Composes LayerStylePicker, ManualZoneSelector, RegionList,
 * and OfflineMapViewer, and delegates all download logic to useDownloadManager.
 */
import { useState } from 'react';
import L from 'leaflet';
import { useTranslation } from 'react-i18next';
import { PRESET_REGIONS } from '../../utils/MapUtils';
import AlertModal, { type AlertType } from '../../components/AlertModalProps';
import OfflineMapViewer from '../../components/OfflineMapViewer';
import LayerStylePicker from './components/LayerStylePicker';
import ManualZoneSelector from './components/ManualZoneSelector';
import RegionList from './components/RegionList';
import { useDownloadManager } from './hooks/useDownloadManager';

interface DownloadMapScreenProps {
  onBack: () => void;
}

export default function DownloadMapScreen({ onBack }: DownloadMapScreenProps) {
  const { t } = useTranslation();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [isManualSelecting, setIsManualSelecting] = useState(false);
  const [viewingRegion, setViewingRegion] = useState<number | string | null>(null);
  const [selectedStyles, setSelectedStyles] = useState<string[]>(() => {
    const theme = localStorage.getItem('eris_theme') || 'dark';
    const initialStyle = theme === 'light' ? 'light' : theme === 'contrasted' ? 'contrasted' : 'dark';
    return [initialStyle];
  });

  // Alert modal
  const defaultDialogState = {
    isOpen: false,
    title: '',
    message: '',
    type: 'info' as AlertType,
    isConfirm: false,
    isPrompt: false,
    defaultValue: '',
    confirmText: '',
    onConfirm: (val?: string) => {},
    onCancel: () => {},
  };
  const [dialog, setDialog] = useState(defaultDialogState);
  const closeDialog = () => setDialog((prev) => ({ ...prev, isOpen: false }));
  const openDialog = (options: Partial<typeof defaultDialogState>) => {
    setDialog({
      ...defaultDialogState,
      ...options,
      isOpen: true,
    });
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
    downloadingId,
    progress,
    downloadedRegions,
    customRegions,
    metadata,
    setCustomRegions,
    getBoundsForRegion,
    handleDownload,
    handleDelete,
  } = useDownloadManager({ t, openDialog, closeDialog, showAlert });

  const toggleStyle = (id: string) => {
    if (selectedStyles.includes(id) && selectedStyles.length === 1) return;

    setSelectedStyles((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  };

  const handleConfirmManualArea = (bounds: L.LatLngBounds) => {
    openDialog({
      title: t('download.promptTitle', 'Name your area'),
      message: t('download.promptName', 'Choose a name for this personalized zone:'),
      type: 'info',
      isPrompt: true,
      defaultValue: t('download.defaultName', 'My Zone'),
      confirmText: t('common.save', 'Save'),
      onCancel: () => closeDialog(),
      onConfirm: (customName) => {
        closeDialog();
        if (customName && customName.trim() !== '') {
          const customId = `custom_${Date.now()}`;
          const newCustomRegion = {
            id: customId,
            name: customName.trim(),
            size: 'Custom Area',
            bounds: {
              southWest: [bounds.getSouthWest().lat, bounds.getSouthWest().lng],
              northEast: [bounds.getNorthEast().lat, bounds.getNorthEast().lng],
            },
          };

          const updatedCustomRegions = [newCustomRegion, ...customRegions];
          setCustomRegions(updatedCustomRegions);
          localStorage.setItem('eris_custom_regions', JSON.stringify(updatedCustomRegions));

          setIsManualSelecting(false);
          handleDownload(customId, customName.trim(), selectedStyles, bounds);
        }
      },
    });
  };

  const normalizeText = (text: string) => {
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[\s-]/g, '')
      .toLowerCase();
  };

  const displayRegions = [...customRegions, ...PRESET_REGIONS];

  const filteredRegions = displayRegions.filter((region) => {
    const searchLower = normalizeText(searchQuery);
    const isCustom = String(region.id).startsWith('custom_');

    const translatedName = normalizeText(t(region.name));
    const translatedDetail = region.detail ? normalizeText(t(region.detail)) : '';

    const customKeywords = [
      'custom', // English
      'personnalis', // French (catches personnalisée, personnalisé)
      'manokan', // Malagasy (catches manokana)
      'tùy chỉnh', // Vietnamese
      'tuy chinh', // Vietnamese (without accents)
      '自定义', // Chinese
    ];
    const isCustomSearch =
      searchLower.length >= 3 && customKeywords.some((k) => normalizeText(k).includes(searchLower));

    return (
      searchLower === '' ||
      translatedName.includes(searchLower) ||
      translatedDetail.includes(searchLower) ||
      (isCustom && isCustomSearch)
    );
  });

  return (
    <div className="flex flex-col h-full bg-eris-bg w-full overflow-y-auto font-sans relative">
      <AlertModal
        isOpen={dialog.isOpen}
        title={dialog.title}
        message={dialog.message}
        type={dialog.type}
        isConfirm={dialog.isConfirm}
        isPrompt={dialog.isPrompt}
        defaultValue={dialog.defaultValue}
        confirmText={dialog.confirmText}
        onConfirm={dialog.onConfirm}
        onCancel={dialog.onCancel}
      />

      {/* Offline map viewer */}
      {viewingRegion !== null &&
        (() => {
          const bounds = getBoundsForRegion(viewingRegion);
          const regionObj = displayRegions.find((r) => String(r.id) === String(viewingRegion));

          if (!bounds || !regionObj) return null;

          const isCustom = String(regionObj.id).startsWith('custom_');
          return (
            <OfflineMapViewer
              name={regionObj.name}
              detail={regionObj.detail}
              isCustom={isCustom}
              bounds={bounds}
              onClose={() => setViewingRegion(null)}
              availableStyles={metadata[viewingRegion]?.styles}
            />
          );
        })()}

      {/* Manual selection overlay*/}
      {isManualSelecting ? (
        <ManualZoneSelector t={t} onClose={() => setIsManualSelecting(false)} onConfirmArea={handleConfirmManualArea} />
      ) : (
        <div className="flex flex-col h-full bg-eris-bg w-full overflow-y-auto font-sans relative pb-0">
          {/* HEADER */}
          <header className="flex justify-between items-center px-6 py-4 sticky top-0 z-50 bg-eris-bg/90 backdrop-blur-md">
            <div className="flex items-center">
              <button
                onClick={onBack}
                className="text-eris-text-muted hover:text-eris-text transition-colors mr-4 active:scale-95 flex items-center justify-center w-10 h-10 bg-eris-surface-alt/50 rounded-full"
              >
                <span className="material-symbols-outlined">chevron_left</span>
              </button>
              <h2 className="text-eris-text text-xl font-bold tracking-wide">{t('download.title', 'Download Maps')}</h2>
            </div>

            {/* Custom Area Map Button (Top Right) */}
            <button
              onClick={() => setIsManualSelecting(true)}
              className="text-eris-primary hover:text-eris-primary transition-colors flex items-center justify-center w-10 h-10 bg-eris-primary/10 rounded-full active:scale-95"
              title={t('download.selectCustom', 'Select Custom Area')}
            >
              <span className="material-symbols-outlined text-xl">map</span>
            </button>
          </header>

          <div className="px-4 flex flex-col gap-6 mt-2">
            {/* ─── SEARCH BAR ─── */}
            <div className="flex items-center bg-eris-surface-alt/40 border border-eris-border/50 rounded-2xl px-4 py-3 gap-3 shadow-inner">
              <span className="material-symbols-outlined text-eris-text-muted text-xl">search</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('download.searchPlaceholder', 'Search city or region...')}
                className="bg-transparent text-sm text-eris-text w-full outline-none placeholder-gray-500"
              />
            </div>

            {/* Map style selector */}
            <LayerStylePicker
              t={t}
              selectedStyles={selectedStyles}
              toggleStyle={toggleStyle}
              disabled={downloadingId !== null}
            />

            {/* Region list */}
            <RegionList
              t={t}
              regions={filteredRegions}
              downloadedIds={downloadedRegions}
              downloadingId={downloadingId}
              progress={progress}
              searchQuery={searchQuery}
              onDownload={(id, name) => handleDownload(id, name, selectedStyles)}
              onDelete={handleDelete}
              onView={setViewingRegion}
            />
            {/* Other Custom Area Map Button */}
            <button
              onClick={() => setIsManualSelecting(true)}
              className="w-full bg-eris-surface-alt/40 border-2 border-dashed border-eris-primary/50 text-eris-primary rounded-3xl p-4 flex items-center justify-center gap-3 font-bold shadow-sm hover:bg-eris-surface-alt/80 transition-colors mb-6 active:scale-[0.98]"
            >
              <span className="material-symbols-outlined text-xl">dashboard_customize</span>
              {t('download.createCustomZone', 'Create a Custom Zone')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
