/**
 * ProfileStatusBar.tsx
 *
 * Displays the real-time GPS and Battery hardware status,
 * as well as the main Identity Card of the user.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';

interface ProfileStatusBarProps {
  location: { lat: string; lng: string } | null;
  batteryLevel: number | null;
  profileData: any;
  userId: string | null;
}

export default function ProfileStatusBar({ location, batteryLevel, profileData, userId }: ProfileStatusBarProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-5">
      {/* ─── REAL-TIME STATUS BAR ─── */}
      <div className="flex items-center gap-3">
        {/* GPS Status */}
        <div className="flex-1 bg-eris-surface-alt/60 rounded-2xl p-3 flex items-center gap-3 border border-eris-border/50">
          <div className="w-8 h-8 rounded-full bg-eris-primary/20 flex items-center justify-center text-eris-primary">
            <span className="material-symbols-outlined text-lg">location_on</span>
          </div>
          <div>
            <p className="text-[10px] text-eris-text-muted font-medium uppercase tracking-wider mb-0.5">
              {t('profile.currentPosition', 'Current Position')}
            </p>
            <p className="text-eris-text text-xs font-mono">
              {location ? `${location.lat}° N, ${location.lng}° E` : t('profile.locating', 'Locating...')}
            </p>
          </div>
        </div>

        {/* Battery Status */}
        <div className="bg-eris-surface-alt/60 rounded-2xl p-3 flex items-center justify-center gap-2 border border-eris-border/50 min-w-[80px]">
          <span
            className={`material-symbols-outlined text-lg ${batteryLevel && batteryLevel > 20 ? 'text-eris-success' : 'text-eris-danger'}`}
          >
            {batteryLevel && batteryLevel > 90
              ? 'battery_full'
              : batteryLevel && batteryLevel > 20
                ? 'battery_5_bar'
                : 'battery_1_bar'}
          </span>
          <span className="text-eris-text font-bold text-sm">{batteryLevel !== null ? `${batteryLevel}%` : '--%'}</span>
        </div>
      </div>

      {/* ─── IDENTITY CARD ─── */}
      <div className="bg-gradient-to-br from-eris-primary/40 to-gray-800/60 [.theme-light_&]:from-blue-300 [.theme-light_&]:to-gray-400 border border-eris-primary/30 rounded-3xl p-5 flex items-center gap-4">
        <div className="w-16 h-16 bg-eris-primary/20 rounded-full flex items-center justify-center border border-eris-primary/30 text-eris-primary">
          <span className="material-symbols-outlined text-3xl">person</span>
        </div>
        <div>
          <h3 className="text-eris-text text-xl font-bold">
            {profileData ? `${profileData.first_name} ${profileData.last_name}` : t('profile.loading', 'Loading...')}
          </h3>
          <p className="text-eris-primary/70 text-xs font-mono mt-0.5 mb-2">ERIS-ID: {userId?.slice(0, 8)}</p>
          <div className="flex items-center gap-1.5 bg-eris-success/10 w-fit px-2 py-1 rounded-md">
            <span className="w-1.5 h-1.5 bg-eris-success rounded-full"></span>
            <span className="text-eris-success text-[10px] font-semibold uppercase tracking-wider">
              {t('profile.verified', 'Verified Account')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
