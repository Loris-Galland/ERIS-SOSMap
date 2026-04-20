import { useState } from 'react';
import { supabase } from '../db/supabaseClient';

interface SetupProfileScreenProps {
  onComplete: () => void;
  userId: string;
}

export default function SetupProfileScreen({ onComplete, userId }: SetupProfileScreenProps) {
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

    const { error: dbError } = await supabase.from('profiles').upsert({
      id: userId,
      ...formData,
      created_at: new Date().toISOString(),
    });

    if (dbError) {
      console.error('Erreur table profiles:', dbError.message);
      setLoading(false);
      return;
    }

    await supabase.auth.updateUser({
      data: { profile_setup_completed: true },
    });

    setLoading(false);
    onComplete();
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#0f141e] text-white p-6 pt-10 overflow-y-auto z-[5000]">
      <div className="max-w-md w-full mx-auto">
        <h2 className="text-2xl font-bold mb-2 text-center">Medical Profile</h2>
        <p className="text-gray-400 text-sm text-center mb-8">These informations are vital for emergency services.</p>

        <form onSubmit={handleSave} className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-400 ml-1">First Name</label>
              <input
                className="w-full bg-gray-800/60 border border-gray-700 rounded-xl p-3"
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 ml-1">Last Name</label>
              <input
                className="w-full bg-gray-800/60 border border-gray-700 rounded-xl p-3"
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                required
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-400 ml-1">Blood type</label>
            <select
              className="w-full bg-gray-800/60 border border-gray-700 rounded-xl p-3 text-white"
              value={formData.blood_type}
              onChange={(e) => setFormData({ ...formData, blood_type: e.target.value })}
            >
              <option value="">Sélectionner</option>
              <option value="A+">A+</option>
              <option value="A-">A-</option>
              <option value="B+">B+</option>
              <option value="B-">B-</option>
              <option value="AB+">AB+</option>
              <option value="AB-">AB-</option>
              <option value="O+">O+</option>
              <option value="O-">O-</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-400 ml-1">Allergies</label>
            <textarea
              className="w-full bg-gray-800/60 border border-gray-700 rounded-xl p-3 h-20"
              placeholder="Ex: Pénicilline, Arachides..."
              value={formData.allergies}
              onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
            />
          </div>

          <div>
            <label className="text-xs text-gray-400 ml-1">Conditions Médicales</label>
            <textarea
              className="w-full bg-gray-800/60 border border-gray-700 rounded-xl p-3 h-20"
              placeholder="Ex: Diabète, Asthme..."
              value={formData.medical_conditions}
              onChange={(e) => setFormData({ ...formData, medical_conditions: e.target.value })}
            />
          </div>

          <button type="submit" className="w-full py-4 bg-blue-600 rounded-xl font-bold mt-4" disabled={loading}>
            {loading ? 'Downloading...' : 'Finish my Profile'}
          </button>
        </form>
      </div>
    </div>
  );
}
