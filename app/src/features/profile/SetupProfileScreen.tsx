/*
 * SetupProfileScreen.tsx
 * One-time onboarding form shown after a new user signs up. Collects first/last
 * name, blood type, allergies, medical conditions, and medications, then upserts
 * them to the Supabase user_profiles table. Marks the profile as complete in
 * Supabase Auth user metadata and calls onComplete to leave the setup flow.
 */
import { useState } from 'react';
import { supabase } from '../../db/supabaseClient';
import { useTranslation } from 'react-i18next';

interface SetupProfileScreenProps {
  userId: string;
  onComplete: () => void;
}

export default function SetupProfileScreen({ userId, onComplete }: SetupProfileScreenProps) {
  const { t } = useTranslation();

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    blood_type: '',
    allergies: '',
    medical_conditions: '',
    current_medications: '',
  });
  const [loading, setLoading] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error: dbError } = await supabase.from('user_profiles').upsert({
      id: userId,
      ...formData,
      created_at: new Date().toISOString(),
    });

    if (dbError) {
      console.error('Error saving profile:', dbError.message);
      setLoading(false);
      return;
    }

    await supabase.auth.updateUser({
      data: { profile_setup_completed: true },
    });

    setLoading(false);
    onComplete();
  };

  const handleSkip = async () => {
    await supabase.auth.updateUser({
      data: { profile_setup_completed: true },
    });
    onComplete();
  };

  return (
    <div className="flex flex-col h-full w-full bg-eris-bg text-eris-text p-6 pt-12 overflow-y-auto">
      <div className="max-w-md mx-auto w-full">
        <h2 className="text-2xl font-bold mb-2">{t('setupProfile.title')}</h2>
        <p className="text-eris-text-muted text-sm mb-8">{t('setupProfile.subtitle')}</p>

        <form onSubmit={handleSave} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <input
              placeholder={t('setupProfile.firstName')}
              className="bg-eris-surface-alt/50 border border-eris-border rounded-xl p-3 outline-none focus:border-eris-primary"
              value={formData.first_name}
              onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
              required
            />
            <input
              placeholder={t('setupProfile.lastName')}
              className="bg-eris-surface-alt/50 border border-eris-border rounded-xl p-3 outline-none focus:border-eris-primary"
              value={formData.last_name}
              onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
              required
            />
          </div>

          <select
            className="w-full bg-eris-surface-alt/50 border border-eris-border rounded-xl p-3 outline-none text-eris-text-muted appearance-none"
            value={formData.blood_type}
            onChange={(e) => setFormData({ ...formData, blood_type: e.target.value })}
          >
            <option value="">{t('setupProfile.bloodType')}</option>
            {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>

          <textarea
            placeholder={t('setupProfile.allergiesPlaceholder')}
            className="w-full bg-eris-surface-alt/50 border border-eris-border rounded-xl p-3 h-24 outline-none focus:border-eris-primary resize-none"
            value={formData.allergies}
            onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
          />

          <textarea
            placeholder={t('setupProfile.conditionsPlaceholder')}
            className="w-full bg-eris-surface-alt/50 border border-eris-border rounded-xl p-3 h-24 outline-none focus:border-eris-primary resize-none"
            value={formData.medical_conditions}
            onChange={(e) => setFormData({ ...formData, medical_conditions: e.target.value })}
          />

          <textarea
            placeholder={t('setupProfile.medicationsPlaceholder')}
            className="w-full bg-eris-surface-alt/50 border border-eris-border rounded-xl p-3 h-24 outline-none focus:border-eris-primary resize-none"
            value={formData.current_medications}
            onChange={(e) => setFormData({ ...formData, current_medications: e.target.value })}
          />

          <div className="flex flex-col gap-3 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-eris-primary hover:bg-eris-primary rounded-xl font-bold transition-all active:scale-95"
            >
              {loading ? t('setupProfile.saving') : t('setupProfile.save')}
            </button>
            <button
              type="button"
              onClick={handleSkip}
              className="w-full py-3 text-eris-text-subtle hover:text-eris-text transition-colors"
            >
              {t('setupProfile.skip')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
