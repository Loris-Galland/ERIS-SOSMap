import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from './db/supabaseClient';
import { CapacitorErisSosmap } from 'capacitor-eris-sosmap';
import type { PluginListenerHandle } from '@capacitor/core';
import { useTranslation } from 'react-i18next';
import logo from './assets/small_logo.png';
import DiagnosticsModal from './features/settings/DiagnosticsModal';
import { useShakeSOS } from './features/sos/hooks/useShakeSOS';
import { useGPS } from './features/map/hooks/useGPS';
import { useRiskDetection } from './features/risk/hooks/useRiskDetection';
import RiskAlertBanner from './features/risk/RiskAlertBanner';
import { useFallDetection } from './features/sos/hooks/useFallDetection';
import { useCrashDetection } from './features/sos/hooks/useCrashDetection';
import FallDetectionModal from './components/FallDetectionModal';
import { dispatchSOS } from './services/sosService';
import AuthScreen from './features/auth/AuthScreen';
import AlertScreen from './features/sos/AlertScreen';
import OfflineScreen from './features/offline/OfflineScreen';
import DownloadMapScreen from './features/offline/DownloadMapScreen';
import ProfileScreen from './features/profile/ProfileScreen';
import SettingsScreen from './features/settings/SettingsScreen';
import SetupProfileScreen from './features/profile/SetupProfileScreen';
import MapScreen from './features/map/MapScreen';
import LowBatteryGlobal from './components/LowBatteryGlobal';
import AdminScreen from './features/admin/AdminScreen';
import { useAdmin } from './features/admin/hooks/useAdmin';

export type ActiveTab = 'MAP' | 'ALERTS' | 'OFFLINE' | 'USER' | 'SETTINGS' | 'DOWNLOAD_MAP' | 'PROFILE_SETUP' | 'ADMIN';

export default function App() {
  const { t } = useTranslation();

  // ─── AUTH ───
  const [session, setSession] = useState<any>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const isGuest = localStorage.getItem('eris_is_guest') === 'true';
  const { isAdmin } = useAdmin(session);
  const userId = session?.user?.id || (isGuest ? 'guest_user' : null);

  // ─── GPS — declared early so userPosition is available to SOS callbacks below ───
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const { gpsStatus, userPosition } = useGPS({ isActive: true });

  // ─── AI RISK DETECTION ───
  const { riskEvent, dismissRisk, acknowledgeAsSOS, currentSpeedMs } = useRiskDetection(userId);

  // ─── FALL DETECTION (accelerometer) — active on all tabs ───
  const [showFallModal, setShowFallModal] = useState(false);
  const onFallDetected = useCallback(() => setShowFallModal(true), []);
  useFallDetection(onFallDetected, true);

  // Dispatch SOS automatically when fall countdown expires or user confirms
  const handleFallSOS = useCallback(async () => {
    setShowFallModal(false);
    if (userPosition.lat !== 0 && userPosition.lng !== 0) {
      try {
        await dispatchSOS(
          userId ?? 'guest',
          { lat: userPosition.lat, lng: userPosition.lng, alt: userPosition.alt },
          100,
          'AUTOMATIC FALL DETECTED',
        );
      } catch (err) {
        console.error('[ERIS] Auto fall SOS failed', err);
      }
    }
    setActiveTab('ALERTS');
  }, [userId, userPosition]);

  // ─── CRASH DETECTION (accelerometer + speed arming) — active on all tabs ───
  const [showCrashModal, setShowCrashModal] = useState(false);
  const onCrashDetected = useCallback(() => setShowCrashModal(true), []);
  useCrashDetection({ currentSpeedKmh: currentSpeedMs * 3.6, onCrashDetected, isActive: true });

  // Dispatch SOS automatically when crash countdown expires or user confirms
  const handleCrashSOS = useCallback(async () => {
    setShowCrashModal(false);
    if (userPosition.lat !== 0 && userPosition.lng !== 0) {
      try {
        await dispatchSOS(
          userId ?? 'guest',
          { lat: userPosition.lat, lng: userPosition.lng, alt: userPosition.alt },
          100,
          'AUTOMATIC CRASH DETECTED',
        );
      } catch (err) {
        console.error('[ERIS] Auto crash SOS failed', err);
      }
    }
    setActiveTab('ALERTS');
  }, [userId, userPosition]);

  // ─── NAVIGATION ───
  const [activeTab, setActiveTab] = useState<ActiveTab>('ALERTS');

  // ─── THEME ───
  const [visualTheme, setVisualTheme] = useState(localStorage.getItem('eris_theme') || 'dark');

  // Track whether we already handled the initial redirect after login
  const hasRedirectedRef = useRef(false);

  const getLivePosition = () => {
    return {
      lat: userPosition.lat || 0,
      lng: userPosition.lng || 0,
      alt: userPosition.alt || 0,
    };
  };

  const {
    startListening,
    stopListening,
    isCounting: isShakeCounting,
    countdown: shakeCountdown,
    cancelSOS: cancelShakeSOS,
  } = useShakeSOS(userId, getLivePosition, () => 100);

  const [isShakeActive, setIsShakeActive] = useState<boolean>(
    localStorage.getItem('eris_shake_sos_enabled') === 'true',
  );

  // Synchronize changes broadcasted from the SensorsSection toggle switch
  useEffect(() => {
    const handlePreferenceUpdate = () => {
      const freshValue = localStorage.getItem('eris_shake_sos_enabled') !== 'false';
      setIsShakeActive(freshValue);
    };

    window.addEventListener('eris-shake-preference-changed', handlePreferenceUpdate);
    return () => {
      window.removeEventListener('eris-shake-preference-changed', handlePreferenceUpdate);
    };
  }, []);

  // Apply theme on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('eris_theme') || 'dark';
    document.documentElement.classList.remove('theme-dark', 'theme-light', 'theme-contrasted');
    document.documentElement.classList.add(`theme-${savedTheme}`);
  }, []);

  // Apply theme when it changes
  useEffect(() => {
    document.documentElement.classList.remove('theme-dark', 'theme-light', 'theme-contrasted');
    document.documentElement.classList.add(`theme-${visualTheme}`);
    localStorage.setItem('eris_theme', visualTheme);
  }, [visualTheme]);

  // ─── AUTH LISTENER ───
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsInitializing(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      // Reset redirect flag on each new login so the setup check runs again
      hasRedirectedRef.current = false;
    });

    return () => subscription.unsubscribe();
  }, []);

  // Redirect to profile setup only once after login, never again on re-renders
  useEffect(() => {
    if (!session || hasRedirectedRef.current) return;
    hasRedirectedRef.current = true;

    const isSetupDone = session.user?.user_metadata?.profile_setup_completed;
    if (!isSetupDone) {
      setActiveTab('PROFILE_SETUP');
    } else {
      setActiveTab('ALERTS');
    }
  }, [session]);

  // ─── MESH NETWORK & ACCELEROMETER DAEMONS ───
  useEffect(() => {
    CapacitorErisSosmap.startMeshNetwork();

    const isShakeEnabled = localStorage.getItem('eris_shake_sos_enabled') !== 'false';

    if (isShakeEnabled) {
      startListening(); // Bind motion event capture threads
    } else {
      console.log('[APP] Shake-to-SOS disabled. Forcing hardware sensor shutdown.');
      stopListening(); // Forcibly kills active accelerometer event hooks immediately
    }

    const meshListener = CapacitorErisSosmap.addListener('onMeshMessageReceived', async (data: any) => {
      console.log('[MESH] SOS received from another ERIS user:', data.message);
      try {
        JSON.parse(data.message);
        if (navigator.onLine) {
          console.log('[MESH] Internet available, relaying to Supabase.');
        } else {
          console.log('[MESH] Offline, relaying to neighbors.');
          await CapacitorErisSosmap.broadcastMeshMessage({ message: data.message });
        }
      } catch (e) {
        console.error('[MESH] Error reading Mesh message', e);
      }
    });

    return () => {
      CapacitorErisSosmap.stopMeshNetwork();
      meshListener.then((listener: PluginListenerHandle) => listener.remove());

      // Fallback hardware cleanup
      stopListening();
    };
  }, [session, isGuest, activeTab, isShakeActive]);

  // ─── LOADING ───
  if (isInitializing) {
    return <div className="h-screen w-full bg-eris-bg" />;
  }

  // ─── APP ───
  return (
    <div className="flex flex-col h-screen w-full bg-eris-bg text-eris-text overflow-hidden font-sans">
      <LowBatteryGlobal />

      {/* ─── GLOBAL SHAKE TO SOS NOTIFICATION BANNER ─── */}
      {isShakeCounting && (
        <div className="absolute top-4 left-4 right-4 bg-red-600 text-white p-4 rounded-xl shadow-2xl z-[9999] flex flex-col gap-3 border border-red-500 animate-bounce">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined animate-spin text-xl">vibration</span>
              <span className="font-bold tracking-wide">
                {t('shake.banner_title', 'Sending SOS in {{seconds}}s', { seconds: shakeCountdown })}
              </span>
            </div>
            <span className="text-xs bg-black/30 px-2 py-0.5 rounded-full font-mono">
              {t('shake.banner_badge', 'Hardware Shake')}
            </span>
          </div>
          <button
            onClick={cancelShakeSOS}
            className="w-full bg-white text-red-700 font-extrabold py-2 rounded-lg text-sm hover:bg-slate-100 transition-colors active:scale-[0.98]"
          >
            {t('shake.banner_cancel', 'CANCEL DISPATCH')}
          </button>
        </div>
      )}

      <header className="flex justify-between items-center px-5 py-3 bg-eris-bg/95 backdrop-blur-md border-b border-eris-border/50 z-[1000] relative">
        <div className="flex items-center gap-2">
          <img src={logo} alt="ERIS-SOSMap" className="h-7 w-auto object-contain" />
        </div>
        <h1 className="flex-1 text-center text-eris-text text-lg font-bold tracking-wide">ERIS Safety</h1>

        {/* DIAGNOSTICS BUTTON */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowDiagnostics(true)}
            className="w-8 h-8 rounded-full bg-eris-surface flex items-center justify-center text-eris-text-subtle hover:text-eris-text transition-colors"
          >
            <span className="material-symbols-outlined text-lg">signal_cellular_alt</span>
          </button>

          <button
            className="bg-eris-danger hover:opacity-90 text-eris-text text-xs font-bold uppercase tracking-wider px-4 py-1.5 rounded-full transition-colors shadow-lg shadow-red-900/20 active:scale-95"
            onClick={() => setActiveTab('ALERTS')}
          >
            SOS
          </button>
        </div>
      </header>

      {/* ─── MAIN CONTENT ─── */}
      <main className="flex-1 relative overflow-hidden">
        {/* MAP — always mounted to keep GPS active in background */}
        <div className={`absolute inset-0 ${activeTab === 'MAP' ? 'z-10' : 'hidden'}`}>
          <MapScreen
            isActive={activeTab === 'MAP'}
            visualTheme={visualTheme}
            session={session}
            isAdmin={isAdmin}
            onNavigateToAlerts={() => setActiveTab('ALERTS')}
          />
        </div>

        {activeTab === 'ALERTS' && (
          <div className="absolute inset-0 z-20 bg-eris-bg">
            <AlertScreen />
          </div>
        )}

        {activeTab === 'OFFLINE' && (
          <div className="absolute inset-0 z-20 bg-eris-bg">
            <OfflineScreen onBack={() => setActiveTab('MAP')} onNavigateDownload={() => setActiveTab('DOWNLOAD_MAP')} />
          </div>
        )}

        {activeTab === 'DOWNLOAD_MAP' && (
          <div className="absolute inset-0 z-30 bg-eris-bg">
            <DownloadMapScreen onBack={() => setActiveTab('OFFLINE')} />
          </div>
        )}

        {activeTab === 'USER' && (
          <div className="absolute inset-0 z-20 bg-eris-bg">
            {session ? (
              <ProfileScreen onOpenSettings={() => setActiveTab('SETTINGS')} />
            ) : (
              <AuthScreen onOpenSettings={() => setActiveTab('SETTINGS')} />
            )}
          </div>
        )}

        {activeTab === 'PROFILE_SETUP' && session && (
          <div className="absolute inset-0 z-[5000] bg-eris-bg">
            <SetupProfileScreen userId={session.user.id} onComplete={() => setActiveTab('ALERTS')} />
          </div>
        )}

        {activeTab === 'SETTINGS' && (
          <div className="absolute inset-0 z-30 bg-eris-bg">
            <SettingsScreen
              onBack={() => setActiveTab('USER')}
              currentTheme={visualTheme}
              onThemeChange={setVisualTheme}
            />
          </div>
        )}

        {activeTab === 'ADMIN' && isAdmin && (
          <div className="absolute inset-0 z-20 bg-eris-bg">
            <AdminScreen />
          </div>
        )}

        {/* DIAGNOSTICS MODAL */}
        {showDiagnostics && <DiagnosticsModal onClose={() => setShowDiagnostics(false)} gpsStatus={gpsStatus} />}
      </main>

      {/* ─── FALL DETECTION MODAL (highest priority) ─── */}
      {showFallModal && (
        <FallDetectionModal
          type="fall"
          onCancel={() => setShowFallModal(false)}
          onConfirmSOS={handleFallSOS}
        />
      )}

      {/* ─── CRASH DETECTION MODAL (vehicle crash, highest priority) ─── */}
      {!showFallModal && showCrashModal && (
        <FallDetectionModal
          type="crash"
          onCancel={() => setShowCrashModal(false)}
          onConfirmSOS={handleCrashSOS}
        />
      )}

      {/* ─── AI RISK DETECTION BANNER (GPS behavioral patterns) ─── */}
      {!showFallModal && !showCrashModal && (
        <RiskAlertBanner
          event={riskEvent}
          onDismiss={dismissRisk}
          onSendSOS={() => { acknowledgeAsSOS(); setActiveTab('ALERTS'); }}
        />
      )}

      {/* ─── BOTTOM NAV ─── */}
      <nav className="flex items-center justify-around h-20 bg-eris-bg/95 backdrop-blur-md border-t border-eris-border/50 pb-safe z-[1000]">
        {(
          [
            { id: 'ALERTS', icon: 'notifications', label: t('nav.alerts', 'Alerts') },
            { id: 'MAP', icon: 'map', label: t('nav.map', 'Map') },
            { id: 'OFFLINE', icon: 'cloud_download', label: t('nav.offline', 'Offline') },
            { id: 'USER', icon: 'person', label: t('nav.profile', 'Profile') },
            ...(isAdmin
              ? [{ id: 'ADMIN' as const, icon: 'admin_panel_settings', label: t('nav.admin', 'Admin') }]
              : []),
          ] as const
        ).map(({ id, icon, label }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex flex-col items-center justify-center w-16 gap-1 transition-all ${
                isActive ? 'text-eris-primary' : 'text-eris-text-subtle hover:text-eris-text-muted'
              }`}
            >
              <div
                className={`px-4 py-1 rounded-full transition-all ${isActive ? 'bg-eris-primary/10' : 'bg-transparent'}`}
              >
                <span
                  className="material-symbols-outlined text-2xl"
                  style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}
                >
                  {icon}
                </span>
              </div>
              <span className="text-[10px] font-semibold tracking-wide">{label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
