/*
 * Settings section for privacy and safety preferences.
 * Exports PrivacySection, which manages live location sharing, anonymous analytics,
 * and the GDPR-compliant emergency audio recording opt-in toggle.
 * Audio consent state is persisted in localStorage (eris_audio_recording_enabled) and
 * broadcast via a custom DOM event consumed by the audio recording hooks in the sos feature.
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Switch from '../components/Switch';

type AudioPrefs = {
  crash: boolean;
  fall: boolean;
  discrete: boolean;
  shake: boolean;
  manual: boolean;
};

export default function PrivacySection() {
  const { t } = useTranslation();

  const [shareLocation, setShareLocation] = useState(true);
  const [anonymousAnalytics, setAnonymousAnalytics] = useState(true);

  // Audio recording — reads persisted consent; defaults to false (opt-in required)
  const [audioEnabled, setAudioEnabled] = useState<boolean>(
    localStorage.getItem('eris_audio_recording_enabled') === 'true',
  );

  const [recordingPrefs, setRecordingPrefs] = useState<AudioPrefs>({
    crash: true,
    fall: true,
    discrete: true,
    shake: true,
    manual: true,
  });

  // Show the RGPD consent card when the user tries to enable for the first time
  const [showConsent, setShowConsent] = useState(false);

  // Load recording preferences on mount
  useEffect(() => {
    const savedPrefs = localStorage.getItem('eris_audio_prefs');
    if (savedPrefs) {
      try {
        setRecordingPrefs(JSON.parse(savedPrefs));
      } catch (e) {
        console.warn('Failed to parse audio preferences');
      }
    }
  }, []);

  const handleAudioToggle = () => {
    if (!audioEnabled) {
      // User is turning ON — show the consent card before persisting
      setShowConsent(true);
    } else {
      // User is turning OFF — revoke immediately
      setAudioEnabled(false);
      localStorage.setItem('eris_audio_recording_enabled', 'false');
    }
  };

  // User confirmed they have read and accept the consent terms
  const handleConsentAccept = () => {
    setShowConsent(false);
    setAudioEnabled(true);
    localStorage.setItem('eris_audio_recording_enabled', 'true');
    localStorage.setItem('eris_audio_prefs', JSON.stringify(recordingPrefs));
    window.dispatchEvent(new CustomEvent('eris-audio-preference-changed'));
  };

  const handleConsentDecline = () => {
    setShowConsent(false);
  };

  // Handle toggling individual SOS types
  const handleRecordingToggle = (key: keyof AudioPrefs) => {
    const newPrefs = { ...recordingPrefs, [key]: !recordingPrefs[key] };
    setRecordingPrefs(newPrefs);
    localStorage.setItem('eris_audio_prefs', JSON.stringify(newPrefs));
  };

  return (
    <section>
      <h3 className="text-eris-text-muted text-xs font-bold uppercase tracking-widest mb-3 px-2">
        {t('settings.privacyTitle', 'Privacy & Safety')}
      </h3>

      <div className="bg-eris-surface-alt/40 border border-eris-border/50 rounded-3xl overflow-hidden">
        {/* Share live location */}
        <div className="flex items-center justify-between p-4 border-b border-eris-border/30">
          <div>
            <p className="text-eris-text text-sm font-medium">{t('settings.shareLocation', 'Share Live Location')}</p>
            <p className="text-eris-text-subtle text-[11px]">
              {t('settings.shareLocationDesc', 'Allow rescue teams to find you')}
            </p>
          </div>
          <Switch active={shareLocation} onClick={() => setShareLocation(!shareLocation)} />
        </div>

        {/* Anonymous analytics */}
        <div className="flex items-center justify-between p-4 border-b border-eris-border/30">
          <div>
            <p className="text-eris-text text-sm font-medium">{t('settings.analytics', 'Anonymous Analytics')}</p>
            <p className="text-eris-text-subtle text-[11px]">
              {t('settings.analyticsDesc', 'Help us improve the ERIS network')}
            </p>
          </div>
          <Switch active={anonymousAnalytics} onClick={() => setAnonymousAnalytics(!anonymousAnalytics)} />
        </div>

        {/* Emergency audio recording */}
        <div className="flex items-center justify-between p-4">
          <div className="flex-1 mr-4">
            <p className="text-eris-text text-sm font-medium">
              {t('settings.audioRecording', 'Emergency Audio Recording')}
            </p>
            <p className="text-eris-text-subtle text-[11px] leading-relaxed">
              {t(
                'settings.audioRecordingDesc',
                'Record up to 5 minutes of ambient audio in the background during selected emergencies to collect evidence.',
              )}
            </p>
          </div>
          <Switch active={audioEnabled} onClick={handleAudioToggle} />
        </div>

        {/* AUDIO RECORDING SUB-MENU: Only shows if Master Switch is ON */}
        {audioEnabled && (
          <div className="bg-eris-surface/30 border-t border-eris-border/30 px-4 py-3 flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
            <p className="text-[11px] font-bold text-eris-text-muted uppercase tracking-wider">
              {t('settings.audioGranularTitle', 'Record automatically for:')}
            </p>

            {(
              [
                { key: 'crash', label: t('settings.sosTypeCrash', 'Vehicle Crash Detection') },
                { key: 'fall', label: t('settings.sosTypeFall', 'Fall Detection') },
                { key: 'discrete', label: t('settings.sosTypeDiscrete', 'Discrete SOS (Stealth)') },
                { key: 'shake', label: t('settings.sosTypeShake', 'Shake-to-SOS') },
                { key: 'manual', label: t('settings.sosTypeManual', 'Manual Button Press') },
              ] as const
            ).map((item) => (
              <div key={item.key} className="flex items-center justify-between">
                <span className="text-eris-text text-xs font-medium">{item.label}</span>
                <Switch active={recordingPrefs[item.key]} onClick={() => handleRecordingToggle(item.key)} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* RGPD consent card — shown inline when activating for the first time */}
      {showConsent && (
        <div className="mt-3 bg-eris-surface border border-eris-primary/40 rounded-2xl p-4 flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-eris-primary text-xl">policy</span>
            <p className="text-eris-text font-bold text-sm">
              {t('settings.audioConsentTitle', 'Before enabling audio recording')}
            </p>
          </div>
          <ul className="text-eris-text-muted text-[11px] leading-relaxed space-y-1 pl-1">
            <li>
              •{' '}
              {t(
                'settings.audioConsent1',
                'Up to 5 minutes of audio is recorded automatically in the background during your configured emergency triggers.',
              )}
            </li>
            <li>• {t('settings.audioConsent2', 'Recordings are stored securely and deleted after 30 days.')}</li>
            <li>• {t('settings.audioConsent3', 'Only you and your emergency contacts can access them.')}</li>
            <li>• {t('settings.audioConsent4', 'You can disable this at any time from this screen.')}</li>
            <li>• {t('settings.audioConsent5', 'This feature processes health data (GDPR Art. 9).')}</li>
          </ul>
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleConsentDecline}
              className="flex-1 py-2.5 rounded-xl border border-eris-border/60 text-eris-text-muted text-xs font-bold active:scale-95 transition-all"
            >
              {t('common.cancel', 'Cancel')}
            </button>
            <button
              onClick={handleConsentAccept}
              className="flex-1 py-2.5 rounded-xl bg-eris-primary text-white text-xs font-bold active:scale-95 transition-all"
            >
              {t('settings.audioConsentAccept', 'I Understand — Enable')}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
