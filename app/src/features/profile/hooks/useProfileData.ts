/*
 * useProfileData.ts
 * Central data hook for the profile feature. Fetches the user's profile and
 * emergency contacts from Supabase (with Dexie fallback when offline), reads
 * GPS and battery levels via Capacitor, and exposes saveMedicalInfo, addContact,
 * updateContact, deleteContact, and deleteAccount mutations consumed by
 * ProfileScreen and its sub-components.
 */
import { useState, useEffect } from 'react';
import { supabase } from '../../../db/supabaseClient';
import { Geolocation } from '@capacitor/geolocation';
import { Device } from '@capacitor/device';
import { db } from '../../../db/localDb';
import { useTranslation } from 'react-i18next';
import { type AlertType } from '../../../components/AlertModalProps';

export function useProfileData() {
  const { t } = useTranslation();

  // ─── DATA STATES ───
  const [profileData, setProfileData] = useState<any>(null);
  const [contacts, setContacts] = useState<any[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  // ─── HARDWARE STATES (GPS & Battery) ───
  const [location, setLocation] = useState<{ lat: string; lng: string } | null>(null);
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);

  // ─── UI & ALERT STATES ───
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const defaultDialogState = {
    isOpen: false, title: '', message: '', type: 'info' as AlertType,
    isConfirm: false, isPrompt: false, defaultValue: '', confirmText: '',
    onConfirm: (val?: string) => {}, onCancel: () => {},
  };
  const [dialog, setDialog] = useState(defaultDialogState);

  const closeDialog = () => setDialog((prev) => ({ ...prev, isOpen: false }));
  const openDialog = (options: Partial<typeof defaultDialogState>) => {
    setDialog({ ...defaultDialogState, ...options, isOpen: true });
  };
  const showAlert = (title: string, message: string, type: AlertType = 'info') => {
    openDialog({ title, message, type, confirmText: 'OK', onConfirm: closeDialog, onCancel: closeDialog });
  };

  // ─── LIFECYCLE ───
  useEffect(() => {
    fetchInitialData();
    fetchHardwareStatus();
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      console.log('[ERIS] Network restored! Reloading profile data...');
      fetchInitialData();
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  // ─── HARDWARE FETCHING ───
  const fetchHardwareStatus = async () => {
    try {
      let permStatus = await Geolocation.checkPermissions();
      if (permStatus.location !== 'granted') {
        permStatus = await Geolocation.requestPermissions();
      }
      if (permStatus.location === 'granted') {
        const coordinates = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 });
        setLocation({
          lat: coordinates.coords.latitude.toFixed(4),
          lng: coordinates.coords.longitude.toFixed(4),
        });
      } else {
        setLocation({ lat: 'Denied', lng: 'Denied' });
      }
    } catch (error) {
      console.error('Error getting location:', error);
      setLocation({ lat: 'Error', lng: 'Error' });
    }

    try {
      const info = await Device.getBatteryInfo();
      if (info.batteryLevel !== undefined) {
        setBatteryLevel(Math.round(info.batteryLevel * 100));
      }
    } catch (error) {
      console.error('Error getting native battery:', error);
      setBatteryLevel(null);
    }
  };

  // ─── DATABASE FETCHING ───
  const fetchInitialData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserId(user.id);
      const { data: profile } = await supabase.from('user_profiles').select('*').eq('id', user.id).single();
      
      if (profile) {
        setProfileData(profile);
        await db.userProfile.put({
          id: user.id,
          firstName: profile.first_name || '', lastName: profile.last_name || '',
          bloodType: profile.blood_type || 'Unknown', allergies: profile.allergies || 'None',
          medicalConditions: profile.medical_conditions || 'None', currentCondition: profile.current_condition || 'Healthy',
        });
      }
      fetchContacts(user.id);
    }
  };

  const fetchContacts = async (uid: string) => {
    if (navigator.onLine) {
      const { data, error } = await supabase.from('emergency_contacts').select('*').eq('user_id', uid).order('id', { ascending: true });
      if (!error && data) {
        setContacts(data);
        if (db.emergencyContacts) await db.emergencyContacts.bulkPut(data);
      }
    } else {
      if (db.emergencyContacts) {
        const localContacts = await db.emergencyContacts.where('user_id').equals(uid).toArray();
        setContacts(localContacts);
      }
    }
  };

  // ─── MUTATIONS ───
  const saveMedicalInfo = async (medicalForm: any) => {
    if (!userId) return false;
    setIsSaving(true);
    try {
      const { error } = await supabase.from('user_profiles').update(medicalForm).eq('id', userId);
      if (error) throw error;

      const updatedProfile = { ...profileData, ...medicalForm };
      setProfileData(updatedProfile);
      await db.userProfile.put({
        id: userId,
        firstName: updatedProfile.first_name || '', lastName: updatedProfile.last_name || '',
        bloodType: updatedProfile.blood_type || 'Unknown', allergies: updatedProfile.allergies || 'None',
        medicalConditions: updatedProfile.medical_conditions || 'None', currentCondition: updatedProfile.current_condition || 'Healthy',
      });
      return true;
    } catch (err) {
      showAlert(t('common.error', 'Error'), t('profile.saveError', 'An error occurred while saving medical info.'), 'danger');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const addContact = async (newContact: any) => {
    if (!userId) return false;
    setIsSaving(true);
    const tempId = `local_${Date.now()}`;
    const contactToSave = { id: tempId, ...newContact, user_id: userId };

    try {
      if (navigator.onLine) {
        const { data, error } = await supabase.from('emergency_contacts').insert([{ ...newContact, user_id: userId }]).select();
        if (error) throw error;
        setContacts([...contacts, ...data]);
        if (db.emergencyContacts) await db.emergencyContacts.put(data[0]);
      } else {
        if (db.emergencyContacts) await db.emergencyContacts.put({ ...contactToSave, sync_status: 'pending' });
        setContacts([...contacts, contactToSave]);
        showAlert(t('profile.offlineMode', 'Offline Mode'), t('profile.contactSavedOffline', 'Contact saved locally. It will be synced when the network is restored.'), 'info');
      }
      return true;
    } catch (err) {
      showAlert(t('common.error', 'Error'), t('profile.addContactError', 'An error occurred while adding the contact.'), 'danger');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const updateContact = async (contactId: string, editForm: any) => {
    setIsSaving(true);
    try {
      const { error } = await supabase.from('emergency_contacts').update(editForm).eq('id', contactId);
      if (error) throw error;
      setContacts(contacts.map((c) => (c.id === contactId ? { ...c, ...editForm } : c)));
      return true;
    } catch (err) {
      showAlert(t('common.error', 'Error'), t('profile.updateContactError', 'An error occurred while updating the contact.'), 'danger');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const deleteContact = async (contactId: string) => {
    const confirmDelete = window.confirm(t('profile.confirmDelete', 'Are you sure you want to delete this contact?'));
    if (!confirmDelete) return false;

    setIsSaving(true);
    try {
      const { error } = await supabase.from('emergency_contacts').delete().eq('id', contactId);
      if (error) throw error;
      setContacts(contacts.filter((c) => c.id !== contactId));
      return true;
    } catch (err) {
      showAlert(t('common.error', 'Error'), t('profile.deleteContactError', 'An error occurred while deleting the contact.'), 'danger');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const deleteAccount = async () => {
    setIsDeleting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        // Clear offline cache
        if (db.userProfile) await db.userProfile.clear();
        if (db.emergencyContacts) await db.emergencyContacts.clear();

        // Call Supabase RPC
        const { error } = await supabase.rpc('delete_user');
        
        if (error) {
          console.error('RPC Error:', error);
          await supabase.from('user_profiles').delete().eq('id', user.id);
        }
      }

      await supabase.auth.signOut();
      localStorage.removeItem('eris_is_guest');
      return true;
    } catch (error) {
      console.error('Error during account deletion:', error);
      showAlert(t('common.error', 'Error'), t('profile.deleteAccountError', 'Failed to delete account. Please try again.'), 'danger');
      return false;
    } finally {
      setIsDeleting(false);
    }
  };

  return {
    profileData, contacts, userId, location, batteryLevel, isSaving, isDeleting, dialog, openDialog, closeDialog,
    saveMedicalInfo, addContact, updateContact, deleteContact, deleteAccount
  };
}