import { useState } from 'react';
import { supabase } from '../db/supabaseClient';
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
    <div className="flex flex-col h-full w-full bg-[#0f141e] text-white p-6 pt-12 overflow-y-auto">
      <div className="max-w-md mx-auto w-full">
        <h2 className="text-2xl font-bold mb-2">{t('setupProfile.title')}</h2>
        <p className="text-gray-400 text-sm mb-8">{t('setupProfile.subtitle')}</p>

        <form onSubmit={handleSave} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <input
              placeholder={t('setupProfile.firstName')}
              className="bg-gray-800/50 border border-gray-700 rounded-xl p-3 outline-none focus:border-blue-500"
              value={formData.first_name}
              onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
              required
            />
            <input
              placeholder={t('setupProfile.lastName')}
              className="bg-gray-800/50 border border-gray-700 rounded-xl p-3 outline-none focus:border-blue-500"
              value={formData.last_name}
              onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
              required
            />
          </div>

          <select
            className="w-full bg-gray-800/50 border border-gray-700 rounded-xl p-3 outline-none text-gray-300 appearance-none"
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
            className="w-full bg-gray-800/50 border border-gray-700 rounded-xl p-3 h-24 outline-none focus:border-blue-500 resize-none"
            value={formData.allergies}
            onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
          />

          <textarea
            placeholder={t('setupProfile.conditionsPlaceholder')}
            className="w-full bg-gray-800/50 border border-gray-700 rounded-xl p-3 h-24 outline-none focus:border-blue-500 resize-none"
            value={formData.medical_conditions}
            onChange={(e) => setFormData({ ...formData, medical_conditions: e.target.value })}
          />

          <textarea
            placeholder={t('setupProfile.medicationsPlaceholder')}
            className="w-full bg-gray-800/50 border border-gray-700 rounded-xl p-3 h-24 outline-none focus:border-blue-500 resize-none"
            value={formData.current_medications}
            onChange={(e) => setFormData({ ...formData, current_medications: e.target.value })}
          />

          <div className="flex flex-col gap-3 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold transition-all active:scale-95"
            >
              {loading ? t('setupProfile.saving') : t('setupProfile.save')}
            </button>
            <button
              type="button"
              onClick={handleSkip}
              className="w-full py-3 text-gray-500 hover:text-white transition-colors"
            >
              {t('setupProfile.skip')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
