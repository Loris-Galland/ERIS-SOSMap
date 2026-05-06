import { useEffect, useState } from 'react';
import L from 'leaflet';
import { createOfflineLayer, PRESET_REGIONS, MAP_STYLES } from '../../../utils/MapUtils';
import { type AlertType } from '../../../components/AlertModalProps';

// Tile helper functions
const lonToX = (lon: number, z: number) => Math.floor(((lon + 180) / 360) * Math.pow(2, z));
const latToY = (lat: number, z: number) => {
  const latRad = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * Math.pow(2, z));
};

const isTileInZone = (url: string, bounds: L.LatLngBounds) => {
  const match = url.match(/\/(\d+)\/(\d+)\/(\d+)(?:\.\w+)?$/);
  if (!match) return false;
  const z = parseInt(match[1], 10);
  const x = parseInt(match[2], 10);
  const y = parseInt(match[3], 10);
  const minX = lonToX(bounds.getWest(), z);
  const maxX = lonToX(bounds.getEast(), z);
  const minY = latToY(bounds.getNorth(), z);
  const maxY = latToY(bounds.getSouth(), z);
  return x >= minX && x <= maxX && y >= minY && y <= maxY;
};

interface UseDownloadManagerProps {
  t: any;
  openDialog: (option: any) => void;
  closeDialog: () => void;
  showAlert: (title: string, massage: string, type: AlertType) => void;
}

export function useDownloadManager({ t, openDialog, closeDialog, showAlert }: UseDownloadManagerProps) {
  const [downloadingId, setDownloadingId] = useState<number | string | null>(null);
  const [updatingId, setUpdatingId] = useState<number | string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [downloadedRegions, setDownloadedRegions] = useState<(number | string)[]>([]);
  const [customRegions, setCustomRegions] = useState<any[]>([]);
  const [metadata, setMetadata] = useState<Record<number | string, { lastUpdate: number; styles?: string[] }>>({});
  const [storageUsedMB, setStorageUsedMB] = useState(0);

  useEffect(() => {
    const saved = localStorage.getItem('eris_offline_regions');
    if (saved) setDownloadedRegions(JSON.parse(saved));

    const savedCustom = localStorage.getItem('eris_custom_regions');
    if (savedCustom) setCustomRegions(JSON.parse(savedCustom));

    const savedMeta = localStorage.getItem('eris_offline_metadata');
    if (savedMeta) setMetadata(JSON.parse(savedMeta));
  }, []);

  useEffect(() => {
    async function calculateRealStorage() {
      if (navigator.storage && navigator.storage.estimate) {
        try {
          const { usage } = await navigator.storage.estimate();
          const mb = (usage || 0) / (1024 * 1024);
          setStorageUsedMB(Number(mb.toFixed(1)));
        } catch (e) {
          console.error('Erreur de calcul du stockage', e);
        }
      }
    }
    calculateRealStorage();
    const interval = setInterval(calculateRealStorage, 5000);
    return () => clearInterval(interval);
  }, []);

  //  Get bounds of regions
  const getBoundsForRegion = (id: number | string): L.LatLngBounds | undefined => {
    if (typeof id === 'number' || (typeof id === 'string' && !id.startsWith('custom_'))) {
      const preset = PRESET_REGIONS.find((r) => r.id === Number(id));
      return preset ? L.latLngBounds(preset.bounds as any) : undefined;
    } else {
      const customReg = customRegions.find((r) => r.id === id);
      if (customReg) {
        return L.latLngBounds(customReg.bounds.southWest, customReg.bounds.northEast);
      }
    }
    return undefined;
  };

  // Set a region as downloaded
  const saveRegionAsDownloaded = (id: number | string, selectedStyles: string[]) => {
    setDownloadedRegions((prev) => {
      const updated = prev.includes(id) ? prev : [...prev, id];
      localStorage.setItem('eris_offline_regions', JSON.stringify(updated));
      return updated;
    });

    setMetadata((prev) => {
      const newMeta = {
        ...prev,
        [id]: {
          ...prev[id],
          lastUpdate: Date.now(),
          styles: selectedStyles.length > 0 ? selectedStyles : prev[id]?.styles || ['dark'],
        },
      };
      localStorage.setItem('eris_offline_metadata', JSON.stringify(newMeta));
      return newMeta;
    });
  };

  const removeRegionFromDownloaded = (id: number | string) => {
    setDownloadedRegions((prev) => {
      const updated = prev.filter((regionId) => String(regionId) !== String(id));
      localStorage.setItem('eris_offline_regions', JSON.stringify(updated));
      return updated;
    });

    setMetadata((prev) => {
      const newMeta = { ...prev };
      delete newMeta[id];
      localStorage.setItem('eris_offline_metadata', JSON.stringify(newMeta));
      return newMeta;
    });
  };

  // Downloading fonction linked to the ID of the region
  const handleDownload = (
    id: number | string,
    name: string,
    selectedStyles: string[],
    customBounds?: L.LatLngBounds,
  ) => {
    const bounds = customBounds || getBoundsForRegion(id);
    if (!bounds) return;

    setDownloadingId(id);
    setProgress(0);

    const tempDiv = document.createElement('div');
    tempDiv.style.cssText = 'width:256px; height:256px; position:fixed; top:-9999px;';
    document.body.appendChild(tempDiv);
    const tempMap = L.map(tempDiv, { fadeAnimation: false, zoomAnimation: false, inertia: false });
    tempMap.fitBounds(bounds, { animate: false });

    const cleanup = () => {
      setDownloadingId(null);
      if (tempMap) {
        tempMap.remove();
      }
      if (document.body.contains(tempDiv)) {
        document.body.removeChild(tempDiv);
      }
    };

    // --- LAYER CONFIGURATION ---
    const layer = createOfflineLayer().addTo(tempMap);
    const control = (L.control as any).savetiles(layer, {
      zoomlevels: [12, 13, 14, 15, 16, 17],
      confirm: (offlineLayer: any, successCallback: () => void) => {
        const count = offlineLayer._tilesforSave?.length || 0;
        if (count === 0) {
          showAlert(
            t('common.noData', 'No Data'),
            t('download.noTiles', 'No tiles found for this area. Check your zoom levels.'),
            'danger',
          );
          cleanup();
          return false;
        }
        openDialog({
          title: t('download.downloadStarted', 'Download Started'),
          message: t('download.confirmDownload', `Download ${count} tiles for ${name}?`)
            .replace('${count}', count.toString())
            .replace('${name}', name),
          type: 'info',
          isConfirm: true,
          confirmText: t('download.confirmBtn', 'Download'),
          onCancel: () => {
            closeDialog();
            cleanup();
          },
          onConfirm: () => {
            closeDialog();
            successCallback();
          },
        });
      },
      confirmNoTiles: () => {
        showAlert(
          t('download.alreadySavedTitle', 'Already Saved'),
          t('download.alreadyDownloaded', 'This zone is already downloaded.'),
          'success',
        );
        saveRegionAsDownloaded(id, selectedStyles);
        cleanup();
      },
    });
    control.addTo(tempMap);

    let totalTiles = 0;
    let savedTiles = 0;

    const downloadStyleLayer = (styleIndex: number) => {
      if (styleIndex >= selectedStyles.length) {
        setProgress(100);
        showAlert(
          t('common.success', 'Success'),
          t(
            'download.successMultiple',
            `Success : The zone ${name} is available offline (${selectedStyles.length} layers).`,
          )
            .replace('${name}', name)
            .replace('${selectedStyles.length}', selectedStyles.length.toString()),
          'success',
        );
        saveRegionAsDownloaded(id, selectedStyles);
        cleanup();
        return;
      }

      const styleKey = selectedStyles[styleIndex];
      const styleConfig = MAP_STYLES[styleKey as keyof typeof MAP_STYLES];
      const layer = createOfflineLayer(styleConfig.url).addTo(tempMap);

      const control = (L.control as any).savetiles(layer, {
        zoomlevels: [12, 13, 14, 15],
        confirm: (offlineLayer: any, successCallback: () => void) => {
          const tilesToSave = offlineLayer._tilesforSave || [];

          if (tilesToSave.length === 0) {
            if (styleIndex === 0) {
              showAlert(
                t('common.noData', 'No Data'),
                t('download.noTiles', 'No tiles found for this area. Check your zoom levels.'),
                'danger',
              );
            }
            tempMap.removeLayer(layer);
            downloadStyleLayer(styleIndex + 1);
            return false;
          }

          if (styleIndex === 0) {
            let count = tilesToSave.length;
            openDialog({
              title: t('download.multiLayerTitle', 'Multi-layer Download'),
              message: t(
                'download.confirmMultiple',
                `Download ${count} tiles per layer for ${name} (${selectedStyles.length} layers)?`,
              )
                .replace('${count}', count)
                .replace('${name}', name)
                .replace('${selectedStyles.length}', selectedStyles.length.toString()),
              type: 'info',
              isConfirm: true,
              confirmText: t('download.confirmBtn', 'Download All'),
              onCancel: () => {
                closeDialog();
                cleanup();
              },
              onConfirm: () => {
                closeDialog();
                successCallback();
              },
            });
          } else {
            successCallback();
          }
        },
        confirmNoTiles: () => {
          if (styleIndex === 0) {
            showAlert(
              t('download.alreadySavedTitle', 'Already Saved'),
              t('download.alreadyDownloaded', 'This zone is already downloaded.'),
              'success',
            );
            saveRegionAsDownloaded(id, selectedStyles);
            cleanup();
          } else {
            tempMap.removeLayer(layer);
            downloadStyleLayer(styleIndex + 1);
          }
        },
      });

      control.addTo(tempMap);

      layer.on('savestart', (e: any) => {
        totalTiles += e.length || (e._tilesforSave ? e._tilesforSave.length : 0);
      });

      layer.on('savetileend', () => {
        savedTiles++;
        if (totalTiles > 0) {
          const percent = Math.floor((savedTiles / totalTiles) * 100);
          setProgress(Math.min(percent, 99));
        }
      });

      layer.on('saveend', () => {
        tempMap.removeLayer(layer);
        downloadStyleLayer(styleIndex + 1);
      });

      layer.on('tilelayeroffline:saveerror', (err: any) => {
        console.error(`Downloading error on layer ${styleConfig.name}:`, err);
        showAlert(
          t('common.error', 'Error'),
          t('download.errorDownloading', 'Error during downloading. Check your connexion.'),
          'danger',
        );
        cleanup();
      });

      tempMap.whenReady(() => {
        setTimeout(() => {
          try {
            control._saveTiles();
          } catch (e) {
            console.error('Internal error SaveTiles:', e);
            cleanup();
          }
        }, 500);
      });
    };

    downloadStyleLayer(0);
  };

  const handleDelete = (id: number | string, name: string) => {
    openDialog({
      title: t('offline.confirmDeleteTitle', 'Delete Zone'),
      message: t('download.confirmDelete', `Are you sure you want to delete ${name} offline data?`).replace(
        '${name}',
        name,
      ),
      type: 'danger',
      isConfirm: true,
      confirmText: t('offline.delete', 'Delete'),
      onCancel: () => closeDialog(),
      onConfirm: () => {
        closeDialog();
        removeRegionFromDownloaded(id);
        const bounds = getBoundsForRegion(id);

        // If there are no coordinates we stop there with a success
        if (!bounds) {
          showAlert(
            t('common.success', 'Success'),
            t('download.successDelete', `${name} removed from your offline maps.`).replace('${name}', name),
            'success',
          );
          return;
        }

        // If there are coordinates we clean up IndexedDB
        setIsDeleting(true);
        try {
          const request = window.indexedDB.open('leaflet.offline');
          request.onblocked = () => {
            setIsDeleting(false);
            showAlert(
              t('offline.uiUpdatedTitle', 'UI Updated'),
              t('offline.storageLocked', `${name} removed from list, but storage is locked by the map viewer.`).replace(
                '${name}',
                name,
              ),
              'info',
            );
          };

          request.onsuccess = (event: any) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('tiles')) {
              db.close();
              setIsDeleting(false);
              showAlert(
                t('common.success', 'Success'),
                t('download.successDelete', `${name} removed from your offline maps.`).replace('${name}', name),
                'success',
              );
              return;
            }

            const transaction = db.transaction(['tiles'], 'readwrite');
            const store = transaction.objectStore('tiles');
            const cursorRequest = store.openCursor();

            let deletedTilesCount = 0;

            cursorRequest.onsuccess = (e: any) => {
              const cursor = e.target.result;
              if (cursor) {
                const url = cursor.key as string;
                if (isTileInZone(url, bounds)) {
                  cursor.delete();
                  deletedTilesCount++;
                }
                cursor.continue();
              }
            };

            transaction.oncomplete = () => {
              db.close();
              setIsDeleting(false);

              if (deletedTilesCount > 0) {
                openDialog({
                  title: t('offline.storageOptimizedTitle', 'Storage Optimized'),
                  message: t(
                    'offline.deleteSuccessDetailed',
                    `${name} deleted (${deletedTilesCount} tiles removed).\n\nReboot app to instantly free up physical space?`,
                  )
                    .replace('${name}', name)
                    .replace('${deletedTilesCount}', deletedTilesCount.toString()),
                  type: 'success',
                  isConfirm: true,
                  confirmText: t('offline.reboot', 'Reboot'),
                  onCancel: () => closeDialog(),
                  onConfirm: () => {
                    closeDialog();
                    window.location.reload();
                  },
                });
              } else {
                showAlert(
                  t('common.success', 'Success'),
                  t('download.successDelete', `${name} removed from your offline maps.`).replace('${name}', name),
                  'success',
                );
              }
            };

            transaction.onerror = () => {
              setIsDeleting(false);
              showAlert(
                t('common.warning', 'Warning'),
                t('offline.deletePartialError', 'List updated, but some map data could not be cleared.'),
                'danger',
              );
            };
          };

          request.onerror = () => {
            setIsDeleting(false);
            showAlert(
              t('common.warning', 'Warning'),
              t('offline.dbError', 'List updated, but could not access local database.'),
              'danger',
            );
          };
        } catch (error) {
          console.error('Unexpected error during deletion:', error);
          setIsDeleting(false);
          showAlert(
            t('common.error', 'Error'),
            t('offline.deleteSpaceError', 'List updated, but an error occurred while clearing space.'),
            'danger',
          );
        }
      },
    });
  };

  // --- UPDATING LOGIC ---
  const handleUpdate = (id: number | string, name: string) => {
    const bounds = getBoundsForRegion(id);
    if (!bounds) return;

    setUpdatingId(id);
    setProgress(0);

    const tempDiv = document.createElement('div');
    tempDiv.style.cssText = 'width:256px; height:256px; position:fixed; top:-9999px;';
    document.body.appendChild(tempDiv);
    const tempMap = L.map(tempDiv, { fadeAnimation: false, zoomAnimation: false });
    tempMap.fitBounds(bounds);

    const layer = createOfflineLayer().addTo(tempMap);
    const control = (L.control as any).savetiles(layer, {
      zoomlevels: [12, 13, 14, 15, 16, 17],
      confirm: (_: any, success: () => void) => success(),
    });
    control.addTo(tempMap);

    const cleanup = () => {
      setUpdatingId(null);
      tempMap.remove();
      if (document.body.contains(tempDiv)) document.body.removeChild(tempDiv);
    };

    layer.on('savestart', (e: any) => {
      const total = e.length || (e._tilesforSave ? e._tilesforSave.length : 0);
      layer.on('savetileend', () => {
        const current = (layer as any)._tilesforSave?.length || total;
        setProgress((prev) => Math.min(prev + 5, 95));
      });
    });

    layer.on('saveend', () => {
      setProgress(100);

      const now = Date.now();
      setMetadata((prev) => ({
        ...prev,
        [id]: { ...prev[id], lastUpdate: now },
      }));

      const savedMeta = localStorage.getItem('eris_offline_metadata');
      const currentMeta = savedMeta ? JSON.parse(savedMeta) : {};
      currentMeta[id] = { ...currentMeta[id], lastUpdate: now };
      localStorage.setItem('eris_offline_metadata', JSON.stringify(currentMeta));

      setTimeout(() => {
        showAlert(
          t('common.success', 'Success'),
          t('offline.updateSuccess', `${name} updated successfully.`).replace('${name}', name),
          'success',
        );
        cleanup();
      }, 500);
    });

    tempMap.whenReady(() => {
      setTimeout(() => control._saveTiles(), 500);
    });
  };

  return {
    // États
    downloadingId,
    updatingId,
    isDeleting,
    progress,
    downloadedRegions,
    customRegions,
    metadata,
    storageUsedMB,
    // Setters
    setCustomRegions,
    // Actions
    getBoundsForRegion,
    handleDownload,
    handleDelete,
    handleUpdate,
  };
}
