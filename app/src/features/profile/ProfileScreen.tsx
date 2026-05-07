/**
 * ProfileScreen.tsx
 * * Orchestrator for the user profile. Connects the data hook to the UI components.
 * Now includes secure account deletion.
 */
import React from 'react';
import { supabase } from '../../db/supabaseClient';
import { useTranslation } from 'react-i18next';

// Hook and Alert Component
import { useProfileData } from './hooks/useProfileData';
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
    isDeleting,
    dialog,
    openDialog,
    closeDialog,
    saveMedicalInfo,
    addContact,
    updateContact,
    deleteContact,
    deleteAccount,
  } = useProfileData();

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // Secure prompt before deleting the account
  const handleDeleteAccountRequest = () => {
    openDialog({
      title: t('profile.deleteAccountTitle', 'Delete Account'),
      message: t(
        'profile.deleteAccountConfirm',
        'Are you sure you want to permanently delete your account? All your medical data and emergency contacts will be erased. This action cannot be undone.',
      ),
      type: 'danger',
      isConfirm: true,
      confirmText: t('profile.delete', 'Delete'),
      onConfirm: async () => {
        closeDialog();
        await deleteAccount();
      },
      onCancel: closeDialog,
    });
  };

  return (
    <div className="flex flex-col h-full bg-eris-bg w-full overflow-y-auto font-sans relative pb-20">
      {/* Dynamic Context Modal */}
      <AlertModal {...dialog} onConfirm={dialog.onConfirm || closeDialog} onCancel={dialog.onCancel || closeDialog} />

      {/* ─── HEADER ─── */}
      <header className="flex justify-between items-center px-6 py-4 sticky top-[-2px] z-50 bg-eris-bg/90 backdrop-blur-md border-b border-eris-border/30">
        <h2 className="text-eris-text text-xl font-bold tracking-wide">{t('profile.title', 'My Profile')}</h2>
        <button
          onClick={onOpenSettings}
          className="text-eris-text-muted w-10 h-10 bg-eris-surface-alt/50 rounded-full flex items-center justify-center transition-colors hover:text-eris-text hover:bg-eris-surface-alt active:scale-95"
        >
          <span className="material-symbols-outlined">settings</span>
        </button>
      </header>

      {/* ─── MODULAR CONTENT ─── */}
      <div className="px-4 flex flex-col mt-4">
        <ProfileStatusBar location={location} batteryLevel={batteryLevel} profileData={profileData} userId={userId} />

        <MedicalInfoCard profileData={profileData} isSaving={isSaving} onSave={saveMedicalInfo} />

        <EmergencyContacts
          contacts={contacts}
          isSaving={isSaving}
          onAdd={addContact}
          onUpdate={updateContact}
          onDelete={deleteContact}
        />

        <p className="text-eris-text-subtle text-[10px] text-center mb-6 flex items-center justify-center gap-1">
          <span className="material-symbols-outlined text-xs">lock</span>
          {t('profile.securityNote', 'Data is encrypted and shared only during emergency alerts.')}
        </p>
      </div>

      {/* ─── FOOTER (ACCOUNT ACTIONS) ─── */}
      <div className="mt-auto px-4 pb-4 flex flex-col gap-3">
        {/* Critical Delete Account Button */}
        <button
          onClick={handleDeleteAccountRequest}
          disabled={isDeleting}
          className="w-full flex items-center justify-center gap-2 py-3.5 bg-eris-danger/10 text-eris-danger font-bold rounded-2xl border border-eris-danger/20 active:scale-95 transition-all disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-xl">delete_forever</span>
          {isDeleting ? t('profile.deleting', 'Deleting...') : t('profile.deleteAccountBtn', 'Delete My Account')}
        </button>

        {/* Standard Logout Button (Neutral Color) */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-3.5 bg-eris-surface-alt/60 text-eris-text font-semibold rounded-2xl border border-eris-border/50 hover:bg-eris-surface-alt active:scale-95 transition-all"
        >
          <span className="material-symbols-outlined text-xl">logout</span>
          {t('profile.logout', 'Sign Out')}
        </button>
      </div>
    </div>
  );
}
