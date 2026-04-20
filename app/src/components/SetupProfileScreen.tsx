import { useState } from 'react';
import { supabase } from '../db/supabaseClient';

interface SetupProfileScreenProps {
  userId: string;
  onComplete: () => void;
}

export default function SetupProfileScreen({ userId, onComplete }: SetupProfileScreenProps) {
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    blood_type: '',
    allergies: '',
    medical_conditions: '',
  });
  const [loading, setLoading] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // 1. Downloading the profile data to the database
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

    // 2. Updating the metadata to stop showing this screen
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
        <h2 className="text-2xl font-bold mb-2">Medical Information</h2>
        <p className="text-gray-400 text-sm mb-8">
          These informations will help emergency services in case of an SOS alert.
        </p>

        <form onSubmit={handleSave} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <input
              placeholder="First Name"
              className="bg-gray-800/50 border border-gray-700 rounded-xl p-3 outline-none focus:border-blue-500"
              value={formData.first_name}
              onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
              required
            />
            <input
              placeholder="Last Name"
              className="bg-gray-800/50 border border-gray-700 rounded-xl p-3 outline-none focus:border-blue-500"
              value={formData.last_name}
              onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
              required
            />
          </div>

          <select
            className="w-full bg-gray-800/50 border border-gray-700 rounded-xl p-3 outline-none text-gray-300"
            value={formData.blood_type}
            onChange={(e) => setFormData({ ...formData, blood_type: e.target.value })}
          >
            <option value="">Blood Type (Optional)</option>
            {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          <textarea
            placeholder="Allergies (ex: Pénicilline, Arachides...)"
            className="w-full bg-gray-800/50 border border-gray-700 rounded-xl p-3 h-24 outline-none focus:border-blue-500"
            value={formData.allergies}
            onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
          />

          <textarea
            placeholder="Conditions médicales (ex: Diabète, Asthme...)"
            className="w-full bg-gray-800/50 border border-gray-700 rounded-xl p-3 h-24 outline-none focus:border-blue-500"
            value={formData.medical_conditions}
            onChange={(e) => setFormData({ ...formData, medical_conditions: e.target.value })}
          />

          <div className="flex flex-col gap-3 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold transition-all active:scale-95"
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
            <button
              type="button"
              onClick={handleSkip}
              className="w-full py-3 text-gray-500 hover:text-white transition-colors"
            >
              Skip for now
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
