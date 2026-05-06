/**
 * ProfileScreen.tsx
 *
 * Orchestrator for the user profile. Connects the data hook to the UI components.
 */
import React from 'react';
import { supabase } from '../../db/supabaseClient';
import { useTranslation } from 'react-i18next';

// Hook and Alert Component
import { useProfileData } from './hooks/useProfileData';
// ⚠️ Adjust path to your AlertModal
import AlertModal from '../../components/AlertModalProps';

// Sub-components
import ProfileStatusBar from './components/ProfileStatusBar';
import MedicalInfoCard from './components/MedicalInfoCard';
import EmergencyContacts from './components/EmergencyContacts';

interface ProfileScreenProps {
  onOpenSettings: () => void;
}

export default function ProfileScreen({ onOpenSettings }: ProfileScreenProps) {
  const { t } = useTranslation();

  // Bring all the powerful logic from our single hook
  const {
    profileData,
    contacts,
    userId,
    location,
    batteryLevel,
    isSaving,
    dialog,
    closeDialog,
    saveMedicalInfo,
    addContact,
    updateContact,
    deleteContact,
  } = useProfileData();

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="flex flex-col h-full bg-eris-bg w-full overflow-y-auto font-sans relative pb-20">
      {/* Dynamic Context Modal */}
      <AlertModal {...dialog} onConfirm={dialog.onConfirm || closeDialog} onCancel={dialog.onCancel || closeDialog} />

      {/* ─── HEADER ─── */}
      <header className="flex justify-between items-center px-6 py-4 sticky top-[-2px] z-50 bg-eris-bg/90 backdrop-blur-md">
        <h2 className="text-eris-text text-xl font-bold tracking-wide">{t('profile.title', 'My Profile')}</h2>
        <button
          onClick={onOpenSettings}
          className="text-eris-text-muted w-10 h-10 bg-eris-surface-alt/50 rounded-full flex items-center justify-center transition-colors active:scale-95"
        >
          <span className="material-symbols-outlined">settings</span>
        </button>
      </header>

      {/* ─── MODULAR CONTENT ─── */}
      <div className="px-4 flex flex-col mt-2">
        <ProfileStatusBar location={location} batteryLevel={batteryLevel} profileData={profileData} userId={userId} />

        <MedicalInfoCard profileData={profileData} isSaving={isSaving} onSave={saveMedicalInfo} />

        <EmergencyContacts
          contacts={contacts}
          isSaving={isSaving}
          onAdd={addContact}
          onUpdate={updateContact}
          onDelete={deleteContact}
        />

        <p className="text-eris-text-subtle text-[10px] text-center mb-4 flex items-center justify-center gap-1">
          <span className="material-symbols-outlined text-xs">lock</span>
          {t('profile.securityNote', 'Data is encrypted and shared only during emergency alerts.')}
        </p>
      </div>

      {/* ─── FOOTER ─── */}
      <div className="mt-auto px-4 pb-4">
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-3.5 bg-eris-danger/10 text-eris-danger font-semibold rounded-2xl border border-eris-danger/20 active:scale-95 transition-all"
        >
          <span className="material-symbols-outlined text-xl">logout</span> {t('profile.logout', 'Sign Out')}
        </button>
      </div>
    </div>
  );
}
