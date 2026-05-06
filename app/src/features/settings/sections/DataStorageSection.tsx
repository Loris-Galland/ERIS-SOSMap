/**
 * DataStorageSection.tsx
 *
 * Handles offline map caching, IndexedDB calculation, and auto-retry logic.
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Switch from '../components/Switch';
import AlertModal, { type AlertType } from '../../../components/AlertModalProps';

export default function DataStorageSection() {
  const { t } = useTranslation();
  const [autoRetrySos, setAutoRetrySos] = useState(true);
  const [cacheSize, setCacheSize] = useState('Calculating...');

  // Alert Dialog State
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
    setDialog({ ...defaultDialogState, ...options, isOpen: true });
  };
  const showAlert = (title: string, message: string, type: AlertType = 'info') => {
    openDialog({ title, message, type, confirmText: 'OK', onConfirm: closeDialog, onCancel: closeDialog });
  };

  // ─── INDEXED DB LOGIC ───
  const fetchSystemEstimate = async () => {
    if (navigator.storage && navigator.storage.estimate) {
      try {
        const estimate = await navigator.storage.estimate();
        if (estimate.usage !== undefined) {
          const sizeInMB = (estimate.usage / (1024 * 1024)).toFixed(2);
          setCacheSize(`${sizeInMB} MB`);
        }
      } catch (e) {
        console.error('Estimation error', e);
      }
    }
  };

  const calculateStorageSize = () => {
    try {
      const request = window.indexedDB.open('leaflet.offline');
      request.onsuccess = (event: any) => {
        const db = event.target.result;
        const storeNames = Array.from(db.objectStoreNames) as string[];

        if (storeNames.length === 0) {
          setCacheSize('0.00 MB');
          db.close();
          return;
        }

        const transaction = db.transaction(storeNames, 'readonly');
        let totalItems = 0;
        let tablesChecked = 0;

        storeNames.forEach((storeName) => {
          const countRequest = transaction.objectStore(storeName).count();
          countRequest.onsuccess = () => {
            totalItems += countRequest.result;
            tablesChecked++;
            if (tablesChecked === storeNames.length) {
              db.close();
              if (totalItems === 0) setCacheSize('0.00 MB');
              else fetchSystemEstimate();
            }
          };
        });
      };
      request.onerror = () => setCacheSize('0.00 MB');
    } catch (error) {
      console.error('IndexedDB verification error :', error);
      fetchSystemEstimate(); // Fallback
    }
  };

  useEffect(() => {
    calculateStorageSize();
  }, []);

  const clearMapCache = () => {
    openDialog({
      title: 'Clear Cache',
      message: 'Are you sure you want to clear the offline map cache?',
      type: 'danger',
      isConfirm: true,
      confirmText: 'Clear',
      onCancel: closeDialog,
      onConfirm: () => {
        closeDialog();
        try {
          const request = window.indexedDB.open('leaflet.offline');
          request.onsuccess = (event: any) => {
            const db = event.target.result;
            const storeNames = Array.from(db.objectStoreNames) as string[];

            if (storeNames.length === 0) {
              db.close();
              setCacheSize('0.00 MB');
              return;
            }

            const transaction = db.transaction(storeNames, 'readwrite');
            storeNames.forEach((storeName) => {
              transaction.objectStore(storeName).clear();
            });

            transaction.oncomplete = () => {
              db.close();
              setCacheSize('0.00 MB');
              showAlert('Success', 'The map cache has been successfully cleared.', 'success');
            };

            transaction.onerror = () => {
              console.error('Error during cleanup transaction');
              showAlert('Error', 'Error clearing cache.', 'danger');
            };
          };

          request.onerror = (event) => {
            console.error('Error opening IndexedDB', event);
            showAlert('Access Denied', 'Unable to access local cache.', 'danger');
          };
        } catch (error) {
          console.error('Unexpected error :', error);
          showAlert('Error', 'An unexpected error has occurred.', 'danger');
        }
      },
    });
  };

  return (
    <>
      {/* Dialog Context Layer */}
      <AlertModal {...dialog} />

      <section>
        <h3 className="text-eris-text-muted text-xs font-bold uppercase tracking-widest mb-3 px-2">
          {t('settings.dataTitle', 'Data & Storage')}
        </h3>
        <div className="bg-eris-surface-alt/40 border border-eris-border/50 rounded-3xl overflow-hidden">
          {/* Auto-Retry Toggle */}
          <div className="flex items-center justify-between p-4 border-b border-eris-border/30">
            <div>
              <p className="text-eris-text text-sm font-medium">{t('settings.autoRetry', 'Auto-Retry SOS')}</p>
              <p className="text-eris-text-subtle text-[11px]">
                {t('settings.autoRetryDesc', 'Automatically re-send if signal is lost')}
              </p>
            </div>
            <Switch active={autoRetrySos} onClick={() => setAutoRetrySos(!autoRetrySos)} />
          </div>

          {/* Clear Cache Action */}
          <div className="flex items-center justify-between p-4">
            <div>
              <p className="text-eris-text text-sm font-medium">{t('settings.offlineCache', 'Offline Map Cache')}</p>
              <p className="text-eris-text-subtle text-[11px]">
                {t('settings.offlineCacheDesc', 'Currently using {{size}}', { size: cacheSize })}
              </p>
            </div>
            <button
              onClick={clearMapCache}
              disabled={cacheSize === '0.00 MB' || cacheSize === 'Calcul en cours...'}
              className={`text-xs font-bold px-4 py-2 rounded-full transition-all ${
                cacheSize === '0.00 MB' || cacheSize === 'Calcul en cours...'
                  ? 'text-eris-text-subtle bg-gray-700/30 cursor-not-allowed'
                  : 'text-eris-primary bg-eris-primary/10 hover:bg-eris-primary/20 active:scale-95'
              }`}
            >
              {t('settings.clearCache', 'Clear Cache')}
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
