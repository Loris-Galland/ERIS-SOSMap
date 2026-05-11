import { useEffect, useState, useRef } from 'react';
import { supabase } from './db/supabaseClient';
import { CapacitorErisSosmap } from 'capacitor-eris-sosmap';
import type { PluginListenerHandle } from '@capacitor/core';
import { useTranslation } from 'react-i18next';
import logo from './assets/small_logo.png';
import DiagnosticsModal from './features/settings/DiagnosticsModal';
import { useGPS } from './features/map/hooks/useGPS';

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

  // ─── NAVIGATION ───
  const [activeTab, setActiveTab] = useState<ActiveTab>('ALERTS');

  // ─── THEME ───
  const [visualTheme, setVisualTheme] = useState(localStorage.getItem('eris_theme') || 'dark');

  // ─── DIAGNOSTICS ───
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const { gpsStatus } = useGPS({
    mapInstance: useRef(null),
    isActive: true,
  });

  // Track whether we already handled the initial redirect after login
  const hasRedirectedRef = useRef(false);

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

  // ─── MESH NETWORK ───
  useEffect(() => {
    CapacitorErisSosmap.startMeshNetwork();

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
    };
  }, [session, isGuest]);

  // ─── LOADING ───
  if (isInitializing) {
    return <div className="h-screen w-full bg-eris-bg" />;
  }

  // ─── APP ───
  return (
    <div className="flex flex-col h-screen w-full bg-eris-bg text-eris-text overflow-hidden font-sans">
      <LowBatteryGlobal />

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

      {/* ─── BOTTOM NAV ─── */}
      <nav className="flex items-center justify-around h-20 bg-eris-bg/95 backdrop-blur-md border-t border-eris-border/50 pb-safe z-[1000]">
        {(
          [
            { id: 'ALERTS', icon: 'notifications', label: t('nav.alerts', 'Alerts') },
            { id: 'MAP', icon: 'map', label: t('nav.map', 'Map') },
            { id: 'OFFLINE', icon: 'cloud_download', label: t('nav.offline', 'Offline') },
            { id: 'USER', icon: 'person', label: t('nav.profile', 'Profile') },
            ...(isAdmin ? [{ id: 'ADMIN' as const, icon: 'admin_panel_settings', label: 'Admin' }] : []),
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
