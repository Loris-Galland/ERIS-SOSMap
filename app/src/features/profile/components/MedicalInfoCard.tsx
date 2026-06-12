/*
 * MedicalInfoCard.tsx
 * Profile sub-component that shows and allows inline editing of a user's critical
 * medical data: blood type, allergies, conditions, and medications. Form state is
 * kept locally and synced from profileData on mount. Mutations are delegated to
 * ProfileScreen via the onSave callback, which calls useProfileData.saveMedicalInfo.
 */
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface MedicalInfoCardProps {
  profileData: any;
  isSaving: boolean;
  onSave: (form: any) => Promise<boolean>;
}

export default function MedicalInfoCard({ profileData, isSaving, onSave }: MedicalInfoCardProps) {
  const { t } = useTranslation();

  const [isEditingMedical, setIsEditingMedical] = useState(false);
  const [medicalForm, setMedicalForm] = useState({
    blood_type: '',
    allergies: '',
    medical_conditions: '',
    current_medications: '',
  });

  // Sync internal form state when profile data loads or changes
  useEffect(() => {
    if (profileData) {
      setMedicalForm({
        blood_type: profileData.blood_type || '',
        allergies: profileData.allergies || '',
        medical_conditions: profileData.medical_conditions || '',
        current_medications: profileData.current_medications || '',
      });
    }
  }, [profileData]);

  const handleSave = async () => {
    const success = await onSave(medicalForm);
    if (success) setIsEditingMedical(false);
  };

  return (
    <section>
      <div className="flex justify-between items-center mb-3 px-1 mt-5">
        <h3 className="text-eris-text-muted text-xs font-bold uppercase tracking-wider">
          {t('profile.medicalSection', 'Medical Information')}
        </h3>
        <button
          onClick={() => (isEditingMedical ? handleSave() : setIsEditingMedical(true))}
          className="text-eris-primary text-xs font-semibold"
        >
          {isEditingMedical
            ? isSaving
              ? t('profile.saving', 'Saving...')
              : t('profile.save', 'Save')
            : t('profile.edit', 'Edit')}
        </button>
      </div>

      <div className="bg-eris-surface-alt/50 border border-eris-border/50 rounded-3xl p-5 flex flex-col gap-4">
        {/* Blood Type */}
        <div className="flex justify-between items-center border-b border-eris-border/50 pb-3">
          <span className="text-eris-text-muted text-sm">{t('profile.bloodTypeLabel', 'Blood Type :')}</span>
          {isEditingMedical ? (
            <select
              value={medicalForm.blood_type}
              onChange={(e) => setMedicalForm({ ...medicalForm, blood_type: e.target.value })}
              className="bg-eris-surface border border-eris-border text-eris-danger text-xs font-bold p-1 rounded"
            >
              <option value="">N/A</option>
              {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-eris-danger font-bold text-sm bg-eris-danger/10 px-2 py-1 rounded-md">
              {profileData?.blood_type || 'N/A'}
            </span>
          )}
        </div>

        {/* Text Areas */}
        {[
          { label: t('profile.allergiesLabel', 'Allergies'), key: 'allergies' },
          { label: t('profile.conditionsLabel', 'Conditions'), key: 'medical_conditions' },
          { label: t('profile.medicationsLabel', 'Medications'), key: 'current_medications' },
        ].map((field) => (
          <div
            key={field.key}
            className="flex flex-col gap-1 border-b last:border-0 border-eris-border/50 pb-3 last:pb-0"
          >
            <span className="text-eris-text-muted text-sm">{field.label} :</span>
            {isEditingMedical ? (
              <textarea
                value={(medicalForm as any)[field.key]}
                onChange={(e) => setMedicalForm({ ...medicalForm, [field.key]: e.target.value })}
                className="bg-eris-surface/60 border border-eris-border rounded-lg p-2 text-eris-text text-xs outline-none h-12"
              />
            ) : (
              <span className="text-eris-text font-medium text-sm">
                {(profileData as any)?.[field.key] || t('profile.none', 'None')}
              </span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
