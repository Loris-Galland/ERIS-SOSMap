import { useState, useEffect } from 'react';
import { supabase } from '../db/supabaseClient';

interface ProfileScreenProps {
  onOpenSettings: () => void;
}

export default function ProfileScreen({ onOpenSettings }: ProfileScreenProps) {
  // État pour stocker les vraies données de Supabase
  const [profileData, setProfileData] = useState<any>(null);

  // On garde cette info en mock car elle n'est pas dans ta table user_profiles
  const [medications] = useState('Ventolin HFA');

  // Mock emergency contacts (Conservés intacts)
  const [contacts] = useState([
    { id: 1, name: 'Marie Dupont', relation: 'Family', phone: '+33 6 12 34 56 78' },
    { id: 2, name: 'Thomas Girard', relation: 'Friend', phone: '+33 7 98 76 54 32' },
  ]);

  // Récupérer les informations de l'utilisateur connecté
  useEffect(() => {
    const fetchProfile = async () => {
      // 1. Obtenir l'ID de l'utilisateur actuel
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        // 2. Chercher sa fiche médicale dans user_profiles
        const { data, error } = await supabase.from('user_profiles').select('*').eq('id', user.id).single();

        if (data && !error) {
          setProfileData(data);
        }
      }
    };

    fetchProfile();
  }, []);

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      console.log('Logout successful');
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0f141e] w-full overflow-y-auto font-sans relative pb-20">
      {/* ─── HEADER ─── */}
      <header className="flex justify-between items-center px-6 py-4 sticky top-0 z-50 bg-[#0f141e]/90 backdrop-blur-md">
        <h2 className="text-white text-xl font-bold tracking-wide">My Profile</h2>
        <button
          onClick={onOpenSettings}
          className="text-gray-400 hover:text-white transition-colors active:scale-95 flex items-center justify-center w-10 h-10 bg-gray-800/50 rounded-full"
        >
          <span className="material-symbols-outlined">settings</span>
        </button>
      </header>

      <div className="px-4 flex flex-col gap-5">
        {/* ─── STATUS BAR: GPS & BATTERY ─── */}
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-gray-800/60 rounded-2xl p-3 flex items-center gap-3 border border-gray-700/50">
            <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400">
              <span className="material-symbols-outlined text-lg">location_on</span>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider mb-0.5">Current Position</p>
              <p className="text-white text-xs font-mono">48.8566° N, 2.3522° E</p>
            </div>
          </div>

          <div className="bg-gray-800/60 rounded-2xl p-3 flex items-center justify-center gap-2 border border-gray-700/50 min-w-[80px]">
            <span className="material-symbols-outlined text-green-400 text-lg">battery_5_bar</span>
            <span className="text-white font-bold text-sm">84%</span>
          </div>
        </div>

        {/* ─── CITIZEN IDENTITY CARD ─── */}
        <div className="bg-gradient-to-br from-blue-900/40 to-gray-800/60 border border-blue-800/30 rounded-3xl p-5 flex items-center gap-4">
          <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center border border-blue-400/30">
            <span className="material-symbols-outlined text-3xl text-blue-400">person</span>
          </div>
          <div>
            <h3 className="text-white text-xl font-bold">
              {/* Affichage du vrai nom de la base de données */}
              {profileData ? `${profileData.first_name} ${profileData.last_name}` : 'Chargement...'}
            </h3>
            <p className="text-blue-300/70 text-xs font-mono mt-0.5 mb-2">ID: ERIS-F7492</p>
            <div className="flex items-center gap-1.5 bg-green-500/10 w-fit px-2 py-1 rounded-md">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full"></span>
              <span className="text-green-400 text-[10px] font-semibold uppercase tracking-wider">
                Verified Account
              </span>
            </div>
          </div>
        </div>

        {/* ─── MEDICAL INFORMATION ─── */}
        <section>
          <div className="flex justify-between items-center mb-3 px-1">
            <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider">Medical Information</h3>
            <button className="text-blue-400 text-xs font-semibold hover:text-blue-300">Edit</button>
          </div>

          <div className="bg-gray-800/50 border border-gray-700/50 rounded-3xl p-5 flex flex-col gap-4">
            <div className="flex justify-between items-center border-b border-gray-700/50 pb-3">
              <span className="text-gray-400 text-sm">Blood Type :</span>
              <span className="text-red-400 font-bold text-sm bg-red-400/10 px-2 py-1 rounded-md">
                {profileData?.blood_type || 'N/A'}
              </span>
            </div>
            <div className="flex flex-col gap-1 border-b border-gray-700/50 pb-3">
              <span className="text-gray-400 text-sm">Allergies :</span>
              <span className="text-white font-medium">{profileData?.allergies || 'None'}</span>
            </div>
            <div className="flex flex-col gap-1 border-b border-gray-700/50 pb-3">
              <span className="text-gray-400 text-sm">Medical Conditions :</span>
              <span className="text-white font-medium">{profileData?.medical_conditions || 'None'}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-gray-400 text-sm">Current Medications :</span>
              <span className="text-white font-medium">{medications}</span>
            </div>
          </div>
        </section>

        {/* ─── EMERGENCY CONTACTS ─── */}
        <section className="mb-6">
          <div className="flex justify-between items-center mb-3 px-1">
            <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider">Emergency Contacts</h3>
            <button className="flex items-center gap-1 text-blue-400 text-xs font-semibold bg-blue-500/10 px-3 py-1.5 rounded-full hover:bg-blue-500/20 transition-colors">
              <span className="material-symbols-outlined text-sm">add</span> Add New
            </button>
          </div>

          <div className="bg-gray-800/50 border border-gray-700/50 rounded-3xl overflow-hidden flex flex-col">
            {contacts.map((contact, index) => (
              <div
                key={contact.id}
                className={`flex items-center justify-between p-4 ${index !== contacts.length - 1 ? 'border-b border-gray-700/50' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-gray-300 font-bold text-sm">
                    {contact.name.charAt(0)}
                  </div>
                  <div>
                    <h4 className="text-white font-medium text-sm">{contact.name}</h4>
                    <p className="text-gray-400 text-xs">
                      {contact.relation} • {contact.phone}
                    </p>
                  </div>
                </div>
                <button className="w-10 h-10 rounded-full bg-gray-700/50 flex items-center justify-center text-blue-400 hover:bg-gray-700 transition-colors">
                  <span className="material-symbols-outlined text-lg">call</span>
                </button>
              </div>
            ))}
          </div>
        </section>

        <p className="text-gray-500 text-[10px] text-center mb-4 flex items-center justify-center gap-1">
          <span className="material-symbols-outlined text-xs">lock</span>
          Data is encrypted and shared only during emergency alerts.
        </p>
      </div>

      {/* LOGOUT BUTTON */}
      <div className="mt-8 mb-4 px-4">
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-3.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 font-semibold rounded-2xl border border-red-500/20 transition-all active:scale-95"
        >
          <span className="material-symbols-outlined text-xl">logout</span>
          Sign Out
        </button>
      </div>
    </div>
  );
}
