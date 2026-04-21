import { useState, useEffect } from 'react';
import { supabase } from '../db/supabaseClient';

interface ProfileScreenProps {
  onOpenSettings: () => void;
}

export default function ProfileScreen({ onOpenSettings }: ProfileScreenProps) {
  // ─── DATA STATES ───
  const [profileData, setProfileData] = useState<any>(null);
  const [contacts, setContacts] = useState<any[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  // ─── UI STATES ───
  const [isEditingMedical, setIsEditingMedical] = useState(false);
  const [isAddingContact, setIsAddingContact] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // State for the contact currently being edited
  const [editingContactId, setEditingContactId] = useState<string | null>(null);

  // ─── FORM STATES ───
  const [medicalForm, setMedicalForm] = useState({
    blood_type: '',
    allergies: '',
    medical_conditions: '',
    current_medications: '',
  });

  const [newContact, setNewContact] = useState({
    name: '',
    relation: '',
    phone_number: '',
  });

  // Form state for the contact being edited
  const [editContactForm, setEditContactForm] = useState({
    name: '',
    relation: '',
    phone_number: '',
  });

  // Fetch all data on mount
  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      setUserId(user.id);

      // Fetch user profile
      const { data: profile } = await supabase.from('user_profiles').select('*').eq('id', user.id).single();

      if (profile) {
        setProfileData(profile);
        setMedicalForm({
          blood_type: profile.blood_type || '',
          allergies: profile.allergies || '',
          medical_conditions: profile.medical_conditions || '',
          current_medications: profile.current_medications || '',
        });
      }

      // Fetch emergency contacts
      fetchContacts(user.id);
    }
  };

  const fetchContacts = async (uid: string) => {
    const { data, error } = await supabase
      .from('emergency_contacts')
      .select('*')
      .eq('user_id', uid)
      .order('id', { ascending: true }); // Keep the same ordering

    if (!error && data) setContacts(data);
  };

  // ─── MEDICAL ACTIONS ───
  const handleSaveMedical = async () => {
    if (!userId) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.from('user_profiles').update(medicalForm).eq('id', userId);
      if (error) throw error;
      setProfileData({ ...profileData, ...medicalForm });
      setIsEditingMedical(false);
    } catch (err) {
      alert('Error saving medical info');
    } finally {
      setIsSaving(false);
    }
  };

  // ─── CONTACT ACTIONS ───
  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    setIsSaving(true);
    try {
      const { data, error } = await supabase
        .from('emergency_contacts')
        .insert([{ ...newContact, user_id: userId }])
        .select();

      if (error) throw error;
      setContacts([...contacts, ...data]);
      setNewContact({ name: '', relation: '', phone_number: '' });
      setIsAddingContact(false);
    } catch (err) {
      alert('Error adding contact');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteContact = async (contactId: string) => {
    // Request confirmation before deleting
    const confirmDelete = window.confirm('Are you sure you want to delete this contact?');
    if (!confirmDelete) return;

    setIsSaving(true);
    try {
      const { error } = await supabase.from('emergency_contacts').delete().eq('id', contactId);

      if (error) throw error;

      // Update local list by filtering out the deleted contact
      setContacts(contacts.filter((c) => c.id !== contactId));
    } catch (err) {
      console.error(err);
      alert('Error deleting contact');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingContactId) return;
    setIsSaving(true);

    try {
      const { error } = await supabase.from('emergency_contacts').update(editContactForm).eq('id', editingContactId);

      if (error) throw error;

      // Update the contact locally to avoid reloading the entire database
      setContacts(contacts.map((c) => (c.id === editingContactId ? { ...c, ...editContactForm } : c)));

      setEditingContactId(null); // Exit edit mode
    } catch (err) {
      alert('Error updating contact');
    } finally {
      setIsSaving(false);
    }
  };

  const startEditingContact = (contact: any) => {
    setEditingContactId(contact.id);
    setEditContactForm({
      name: contact.name,
      relation: contact.relation,
      phone_number: contact.phone_number,
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="flex flex-col h-full bg-[#0f141e] w-full overflow-y-auto font-sans relative pb-20">
      {/* ─── HEADER ─── */}
      <header className="flex justify-between items-center px-6 py-4 sticky top-0 z-50 bg-[#0f141e]/90 backdrop-blur-md">
        <h2 className="text-white text-xl font-bold tracking-wide">My Profile</h2>
        <button
          onClick={onOpenSettings}
          className="text-gray-400 w-10 h-10 bg-gray-800/50 rounded-full flex items-center justify-center"
        >
          <span className="material-symbols-outlined">settings</span>
        </button>
      </header>

      <div className="px-4 flex flex-col gap-5">
        {/* ─── IDENTITY CARD ─── */}
        <div className="bg-gradient-to-br from-blue-900/40 to-gray-800/60 border border-blue-800/30 rounded-3xl p-5 flex items-center gap-4">
          <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center border border-blue-400/30 text-blue-400">
            <span className="material-symbols-outlined text-3xl">person</span>
          </div>
          <div>
            <h3 className="text-white text-xl font-bold">
              {profileData ? `${profileData.first_name} ${profileData.last_name}` : 'Loading...'}
            </h3>
            <p className="text-blue-300/70 text-xs font-mono">ERIS-ID: {userId?.slice(0, 8)}</p>
          </div>
        </div>

        {/* ─── MEDICAL INFO ─── */}
        <section>
          <div className="flex justify-between items-center mb-3 px-1">
            <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider">Medical Information</h3>
            <button
              onClick={() => (isEditingMedical ? handleSaveMedical() : setIsEditingMedical(true))}
              className="text-blue-400 text-xs font-semibold"
            >
              {isEditingMedical ? (isSaving ? 'Saving...' : 'Save') : 'Edit'}
            </button>
          </div>

          <div className="bg-gray-800/50 border border-gray-700/50 rounded-3xl p-5 flex flex-col gap-4">
            <div className="flex justify-between items-center border-b border-gray-700/50 pb-3">
              <span className="text-gray-400 text-sm">Blood Type :</span>
              {isEditingMedical ? (
                <select
                  value={medicalForm.blood_type}
                  onChange={(e) => setMedicalForm({ ...medicalForm, blood_type: e.target.value })}
                  className="bg-gray-900 border border-gray-700 text-red-400 text-xs font-bold p-1 rounded"
                >
                  <option value="">N/A</option>
                  {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-red-400 font-bold text-sm bg-red-400/10 px-2 py-1 rounded-md">
                  {profileData?.blood_type || 'N/A'}
                </span>
              )}
            </div>

            {/* Quick view fields */}
            {[
              { label: 'Allergies', key: 'allergies' },
              { label: 'Conditions', key: 'medical_conditions' },
              { label: 'Medications', key: 'current_medications' },
            ].map((field) => (
              <div
                key={field.key}
                className="flex flex-col gap-1 border-b last:border-0 border-gray-700/50 pb-3 last:pb-0"
              >
                <span className="text-gray-400 text-sm">{field.label} :</span>
                {isEditingMedical ? (
                  <textarea
                    value={(medicalForm as any)[field.key]}
                    onChange={(e) => setMedicalForm({ ...medicalForm, [field.key]: e.target.value })}
                    className="bg-gray-900/60 border border-gray-700 rounded-lg p-2 text-white text-xs outline-none h-12"
                  />
                ) : (
                  <span className="text-white font-medium text-sm">{(profileData as any)?.[field.key] || 'None'}</span>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ─── EMERGENCY CONTACTS ─── */}
        <section className="mb-6">
          <div className="flex justify-between items-center mb-3 px-1">
            <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider">Emergency Contacts</h3>
            <button
              onClick={() => {
                setIsAddingContact(!isAddingContact);
                setEditingContactId(null); // Close any active edit mode
              }}
              className="flex items-center gap-1 text-blue-400 text-xs font-semibold bg-blue-500/10 px-3 py-1.5 rounded-full"
            >
              <span className="material-symbols-outlined text-sm">{isAddingContact ? 'close' : 'add'}</span>
              {isAddingContact ? 'Cancel' : 'Add New'}
            </button>
          </div>

          {/* Add Contact Form */}
          {isAddingContact && (
            <form
              onSubmit={handleAddContact}
              className="bg-gray-800/80 border border-blue-500/30 rounded-3xl p-5 mb-4 flex flex-col gap-3 animate-in fade-in slide-in-from-top-2"
            >
              <input
                placeholder="Full Name"
                required
                value={newContact.name}
                onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                className="bg-gray-900 border border-gray-700 rounded-xl p-3 text-white text-sm outline-none"
              />
              <div className="flex gap-2">
                <input
                  placeholder="Relation (e.g. Mom)"
                  required
                  value={newContact.relation}
                  onChange={(e) => setNewContact({ ...newContact, relation: e.target.value })}
                  className="flex-1 bg-gray-900 border border-gray-700 rounded-xl p-3 text-white text-sm outline-none"
                />
                <input
                  placeholder="Phone"
                  type="tel"
                  required
                  value={newContact.phone_number}
                  onChange={(e) => setNewContact({ ...newContact, phone_number: e.target.value })}
                  className="flex-1 bg-gray-900 border border-gray-700 rounded-xl p-3 text-white text-sm outline-none"
                />
              </div>
              <button
                disabled={isSaving}
                className="bg-blue-600 text-white font-bold py-3 rounded-xl active:scale-95 transition-all"
              >
                {isSaving ? 'Adding...' : 'Save Contact'}
              </button>
            </form>
          )}

          {/* Contacts List */}
          <div className="bg-gray-800/50 border border-gray-700/50 rounded-3xl overflow-hidden flex flex-col">
            {contacts.length === 0 && !isAddingContact && (
              <p className="text-gray-500 text-xs text-center py-8 italic">No contacts added yet.</p>
            )}

            {contacts.map((contact, index) => (
              <div
                key={contact.id}
                className={`p-4 ${index !== contacts.length - 1 ? 'border-b border-gray-700/50' : ''}`}
              >
                {/* IF THE CONTACT IS IN EDIT MODE */}
                {editingContactId === contact.id ? (
                  <form onSubmit={handleUpdateContact} className="flex flex-col gap-3 animate-in fade-in">
                    <input
                      placeholder="Full Name"
                      required
                      value={editContactForm.name}
                      onChange={(e) => setEditContactForm({ ...editContactForm, name: e.target.value })}
                      className="bg-gray-900 border border-gray-700 rounded-xl p-3 text-white text-sm outline-none"
                    />
                    <div className="flex gap-2">
                      <input
                        placeholder="Relation"
                        required
                        value={editContactForm.relation}
                        onChange={(e) => setEditContactForm({ ...editContactForm, relation: e.target.value })}
                        className="flex-1 bg-gray-900 border border-gray-700 rounded-xl p-3 text-white text-sm outline-none"
                      />
                      <input
                        placeholder="Phone"
                        type="tel"
                        required
                        value={editContactForm.phone_number}
                        onChange={(e) => setEditContactForm({ ...editContactForm, phone_number: e.target.value })}
                        className="flex-1 bg-gray-900 border border-gray-700 rounded-xl p-3 text-white text-sm outline-none"
                      />
                    </div>
                    <div className="flex justify-end gap-2 mt-1">
                      <button
                        type="button"
                        onClick={() => setEditingContactId(null)}
                        className="px-4 py-2 text-gray-400 text-xs font-bold rounded-lg hover:bg-gray-700/50"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSaving}
                        className="px-4 py-2 bg-green-500/20 text-green-400 text-xs font-bold rounded-lg"
                      >
                        {isSaving ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </form>
                ) : (
                  /* NORMAL CONTACT DISPLAY */
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 font-bold text-sm">
                        {contact.name.charAt(0)}
                      </div>
                      <div>
                        <h4 className="text-white font-medium text-sm">{contact.name}</h4>
                        <p className="text-gray-400 text-xs">
                          {contact.relation} • {contact.phone_number}
                        </p>
                      </div>
                    </div>

                    {/* Actions: Edit, Delete, Call */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => startEditingContact(contact)}
                        className="w-8 h-8 rounded-full bg-gray-700/50 flex items-center justify-center text-gray-400 hover:text-white"
                      >
                        <span className="material-symbols-outlined text-sm">edit</span>
                      </button>

                      <button
                        onClick={() => handleDeleteContact(contact.id)}
                        className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center text-red-400 hover:bg-red-500/20"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                      </button>

                      <a
                        href={`tel:${contact.phone_number}`}
                        className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center text-green-400 ml-1"
                      >
                        <span className="material-symbols-outlined text-lg">call</span>
                      </a>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="mt-auto px-4 pb-4">
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-3.5 bg-red-500/10 text-red-500 font-semibold rounded-2xl border border-red-500/20 active:scale-95"
        >
          <span className="material-symbols-outlined text-xl">logout</span> Sign Out
        </button>
      </div>
    </div>
  );
}
