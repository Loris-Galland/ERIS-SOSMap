/*
 * EmergencyContacts.tsx
 * Profile sub-component that lists, adds, edits, and deletes emergency contacts.
 * All mutations are handled by callbacks provided by useProfileData; this
 * component is purely presentational with local form state for the add/edit
 * forms. Each contact row also exposes a direct tel: link to call the person.
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface EmergencyContactsProps {
  contacts: any[];
  isSaving: boolean;
  onAdd: (contact: any) => Promise<boolean>;
  onUpdate: (id: string, contact: any) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
}

export default function EmergencyContacts({ contacts, isSaving, onAdd, onUpdate, onDelete }: EmergencyContactsProps) {
  const { t } = useTranslation();

  const [isAddingContact, setIsAddingContact] = useState(false);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);

  const [newContact, setNewContact] = useState({ name: '', relation: '', phone_number: '' });
  const [editContactForm, setEditContactForm] = useState({ name: '', relation: '', phone_number: '' });

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await onAdd(newContact);
    if (success) {
      setNewContact({ name: '', relation: '', phone_number: '' });
      setIsAddingContact(false);
    }
  };

  const startEditingContact = (contact: any) => {
    setEditingContactId(contact.id);
    setEditContactForm({ name: contact.name, relation: contact.relation, phone_number: contact.phone_number });
  };

  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingContactId) return;
    const success = await onUpdate(editingContactId, editContactForm);
    if (success) setEditingContactId(null);
  };

  return (
    <section className="mb-6">
      <div className="flex justify-between items-center mb-3 px-1 mt-5">
        <h3 className="text-eris-text-muted text-xs font-bold uppercase tracking-wider">
          {t('profile.contactsSection', 'Emergency Contacts')}
        </h3>
        <button
          onClick={() => {
            setIsAddingContact(!isAddingContact);
            setEditingContactId(null);
          }}
          className="flex items-center gap-1 text-eris-primary text-xs font-semibold bg-eris-primary/10 px-3 py-1.5 rounded-full"
        >
          <span className="material-symbols-outlined text-sm">{isAddingContact ? 'close' : 'add'}</span>
          {isAddingContact ? t('profile.cancel', 'Cancel') : t('profile.addNew', 'Add New')}
        </button>
      </div>

      {/* Add New Contact Form */}
      {isAddingContact && (
        <form
          onSubmit={handleAddSubmit}
          className="bg-eris-surface-alt/80 border border-eris-primary/30 rounded-3xl p-5 mb-4 flex flex-col gap-3 animate-in fade-in slide-in-from-top-2"
        >
          <input
            placeholder={t('profile.fullNamePlaceholder', 'Full Name')}
            required
            value={newContact.name}
            onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
            className="bg-eris-surface border border-eris-border rounded-xl p-3 text-eris-text text-sm outline-none"
          />
          <div className="flex gap-2">
            <input
              placeholder={t('profile.relationPlaceholder', 'Relation (e.g. Mom)')}
              required
              value={newContact.relation}
              onChange={(e) => setNewContact({ ...newContact, relation: e.target.value })}
              className="flex-1 bg-eris-surface border border-eris-border rounded-xl p-3 text-eris-text text-sm outline-none"
            />
            <input
              placeholder={t('profile.phonePlaceholder', 'Phone')}
              type="tel"
              required
              value={newContact.phone_number}
              onChange={(e) => setNewContact({ ...newContact, phone_number: e.target.value })}
              className="flex-1 bg-eris-surface border border-eris-border rounded-xl p-3 text-eris-text text-sm outline-none"
            />
          </div>
          <button
            disabled={isSaving}
            className="bg-eris-primary text-eris-text font-bold py-3 rounded-xl active:scale-95 transition-all"
          >
            {isSaving ? t('profile.adding', 'Adding...') : t('profile.saveContact', 'Save Contact')}
          </button>
        </form>
      )}

      {/* Contacts List */}
      <div className="bg-eris-surface-alt/50 border border-eris-border/50 rounded-3xl overflow-hidden flex flex-col">
        {contacts.length === 0 && !isAddingContact && (
          <p className="text-eris-text-subtle text-xs text-center py-8 italic">
            {t('profile.noContacts', 'No contacts added yet.')}
          </p>
        )}

        {contacts.map((contact, index) => (
          <div
            key={contact.id}
            className={`p-4 ${index !== contacts.length - 1 ? 'border-b border-eris-border/50' : ''}`}
          >
            {/* Edit Mode */}
            {editingContactId === contact.id ? (
              <form onSubmit={handleUpdateSubmit} className="flex flex-col gap-3 animate-in fade-in">
                <input
                  placeholder={t('profile.fullNamePlaceholder', 'Full Name')}
                  required
                  value={editContactForm.name}
                  onChange={(e) => setEditContactForm({ ...editContactForm, name: e.target.value })}
                  className="bg-eris-surface border border-eris-border rounded-xl p-3 text-eris-text text-sm outline-none"
                />
                <div className="flex gap-2">
                  <input
                    placeholder={t('profile.relationPlaceholder', 'Relation')}
                    required
                    value={editContactForm.relation}
                    onChange={(e) => setEditContactForm({ ...editContactForm, relation: e.target.value })}
                    className="flex-1 bg-eris-surface border border-eris-border rounded-xl p-3 text-eris-text text-sm outline-none"
                  />
                  <input
                    placeholder={t('profile.phonePlaceholder', 'Phone')}
                    type="tel"
                    required
                    value={editContactForm.phone_number}
                    onChange={(e) => setEditContactForm({ ...editContactForm, phone_number: e.target.value })}
                    className="flex-1 bg-eris-surface border border-eris-border rounded-xl p-3 text-eris-text text-sm outline-none"
                  />
                </div>
                <div className="flex justify-end gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => setEditingContactId(null)}
                    className="px-4 py-2 text-eris-text-muted text-xs font-bold rounded-lg hover:bg-gray-700/50"
                  >
                    {t('profile.cancel', 'Cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-4 py-2 bg-eris-success/20 text-eris-success text-xs font-bold rounded-lg"
                  >
                    {isSaving ? t('profile.saving', 'Saving...') : t('profile.save', 'Save')}
                  </button>
                </div>
              </form>
            ) : (
              /* View Mode */
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-eris-primary/10 flex items-center justify-center text-eris-primary font-bold text-sm">
                    {contact.name.charAt(0)}
                  </div>
                  <div>
                    <h4 className="text-eris-text font-medium text-sm">{contact.name}</h4>
                    <p className="text-eris-text-muted text-xs">
                      {contact.relation} • {contact.phone_number}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => startEditingContact(contact)}
                    className="w-8 h-8 rounded-full bg-gray-700/50 flex items-center justify-center text-eris-text-muted hover:text-eris-text"
                  >
                    <span className="material-symbols-outlined text-sm">edit</span>
                  </button>
                  <button
                    onClick={() => onDelete(contact.id)}
                    className="w-8 h-8 rounded-full bg-eris-danger/10 flex items-center justify-center text-eris-danger hover:bg-eris-danger/20"
                  >
                    <span className="material-symbols-outlined text-sm">delete</span>
                  </button>
                  <a
                    href={`tel:${contact.phone_number}`}
                    className="w-10 h-10 rounded-full bg-eris-success/10 flex items-center justify-center text-eris-success ml-1"
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
  );
}
