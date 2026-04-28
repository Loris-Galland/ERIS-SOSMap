import { useState, useEffect } from 'react';
import { supabase } from '../db/supabaseClient';
import { db } from '../db/localDb';

// Unified alert type merging Supabase and local Dexie records
interface SOSAlert {
  id: string | number;
  source: 'remote' | 'local';
  status: string;
  transmission_method: string;
  latitude?: number;
  longitude?: number;
  altitude?: number;
  battery_level?: number;
  notes?: string;
  timestamp: number;
  first_name?: string;
  last_name?: string;
  blood_type?: string;
  allergies?: string;
  medical_conditions?: string;
  current_condition?: string;
}

interface SOSHistoryScreenProps {
  onClose: () => void;
}

// Returns a human-readable label and color class based on transmission method
function getMethodBadge(method: string): { label: string; color: string } {
  if (method === 'INTERNET') return { label: 'Internet', color: 'text-green-400 bg-green-400/10 border-green-400/20' };
  if (method === 'INTERNET_RETRY') return { label: 'Retry', color: 'text-blue-400 bg-blue-400/10 border-blue-400/20' };
  if (method?.includes('WIFI') || method?.includes('HARDWARE'))
    return { label: 'HW Fallback', color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20' };
  if (method === 'QUEUED_FOR_RETRY')
    return { label: 'Queued', color: 'text-orange-400 bg-orange-400/10 border-orange-400/20' };
  return { label: method ?? 'Unknown', color: 'text-gray-400 bg-gray-400/10 border-gray-400/20' };
}

// Returns a status indicator color
function getStatusColor(status: string): string {
  if (status === 'delivered') return 'bg-green-500';
  if (status === 'delivered_to_hardware') return 'bg-yellow-500';
  if (status === 'queued') return 'bg-orange-500 animate-pulse';
  if (status === 'pending') return 'bg-blue-500 animate-pulse';
  return 'bg-gray-500';
}

// Formats a unix timestamp to a readable date string
function formatDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function SOSHistoryScreen({ onClose }: SOSHistoryScreenProps) {
  const [alerts, setAlerts] = useState<SOSAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAlert, setSelectedAlert] = useState<SOSAlert | null>(null);

  useEffect(() => {
    fetchAllAlerts();
  }, []);

  const fetchAllAlerts = async () => {
    setLoading(true);

    // Fetch remote alerts from Supabase
    const remoteAlerts: SOSAlert[] = [];
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data, error } = await supabase
          .from('sos_alerts')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50);

        if (!error && data) {
          data.forEach((item: any) => {
            remoteAlerts.push({
              id: item.id,
              source: 'remote',
              status: item.status,
              transmission_method: item.transmission_method,
              latitude: item.latitude,
              longitude: item.longitude,
              altitude: item.altitude,
              battery_level: item.battery_level,
              notes: item.notes,
              timestamp: new Date(item.created_at).getTime(),
              first_name: item.first_name,
              last_name: item.last_name,
              blood_type: item.blood_type,
              allergies: item.allergies,
              medical_conditions: item.medical_conditions,
              current_condition: item.current_condition,
            });
          });
        }
      }
    } catch (e) {
      console.warn('Could not fetch remote alerts:', e);
    }

    // Fetch local queued alerts from Dexie
    const localAlerts: SOSAlert[] = [];
    try {
      const queued = await db.sosQueue
        .orderBy('timestamp')
        .reverse()
        .limit(50)
        .toArray();

      queued.forEach((item) => {
        // Avoid duplicates: skip local records that already exist in Supabase
        const alreadyRemote = remoteAlerts.some(
          (r) => Math.abs(r.timestamp - item.timestamp) < 2000 && r.status === item.status
        );
        if (!alreadyRemote || item.status === 'queued') {
          localAlerts.push({
            id: item.id ?? `local_${item.timestamp}`,
            source: 'local',
            status: item.status,
            transmission_method: item.transmission_method,
            latitude: item.lat,
            longitude: item.lon,
            altitude: item.altitude,
            battery_level: item.battery_level,
            notes: item.notes,
            timestamp: item.timestamp,
            first_name: item.first_name,
            last_name: item.last_name,
            blood_type: item.blood_type,
            allergies: item.allergies,
            medical_conditions: item.medical_conditions,
            current_condition: item.current_condition,
          });
        }
      });
    } catch (e) {
      console.warn('Could not fetch local alerts:', e);
    }

    // Merge and sort by timestamp descending
    const merged = [...remoteAlerts, ...localAlerts].sort((a, b) => b.timestamp - a.timestamp);
    setAlerts(merged);
    setLoading(false);
  };

  return (
    <div className="absolute inset-0 z-[4000] bg-[#0f141e] flex flex-col animate-in slide-in-from-bottom duration-300">

      {/* Header */}
      <header className="flex items-center px-6 py-4 sticky top-0 z-50 bg-[#0f141e]/90 backdrop-blur-md border-b border-gray-800/50">
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white transition-colors mr-4 active:scale-95 flex items-center justify-center w-10 h-10 bg-gray-800/50 rounded-full"
        >
          <span className="material-symbols-outlined">chevron_left</span>
        </button>
        <div>
          <h2 className="text-white text-xl font-bold tracking-wide">SOS History</h2>
          <p className="text-gray-500 text-[11px] font-medium">
            {loading ? 'Loading...' : `${alerts.length} alert${alerts.length !== 1 ? 's' : ''} found`}
          </p>
        </div>
        <button
          onClick={fetchAllAlerts}
          className="ml-auto text-gray-400 hover:text-white transition-colors w-10 h-10 bg-gray-800/50 rounded-full flex items-center justify-center active:scale-95"
        >
          <span className="material-symbols-outlined">refresh</span>
        </button>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">

        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <span className="material-symbols-outlined text-gray-600 text-4xl animate-spin">sync</span>
            <p className="text-gray-500 text-sm">Loading your alert history...</p>
          </div>
        )}

        {!loading && alerts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-16 h-16 bg-gray-800/60 rounded-3xl flex items-center justify-center">
              <span className="material-symbols-outlined text-gray-600 text-3xl">history</span>
            </div>
            <div className="text-center">
              <p className="text-gray-400 text-sm font-medium">No alerts yet</p>
              <p className="text-gray-600 text-[11px] mt-1">Your SOS history will appear here</p>
            </div>
          </div>
        )}

        {!loading && alerts.map((alert) => {
          const method = getMethodBadge(alert.transmission_method);
          const isQueued = alert.status === 'queued';

          return (
            <button
              key={`${alert.source}-${alert.id}`}
              onClick={() => setSelectedAlert(alert)}
              className="w-full bg-gray-800/40 border border-gray-700/50 rounded-3xl p-4 flex items-center gap-4 text-left hover:bg-gray-800/60 active:scale-[0.98] transition-all"
            >
              {/* Status dot */}
              <div className="flex flex-col items-center gap-1 shrink-0">
                <div className={`w-3 h-3 rounded-full ${getStatusColor(alert.status)}`} />
                {isQueued && (
                  <span className="material-symbols-outlined text-orange-400 text-sm">cloud_off</span>
                )}
              </div>

              {/* Alert info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-white text-sm font-bold truncate">
                    {alert.first_name && alert.last_name
                      ? `${alert.first_name} ${alert.last_name}`
                      : 'SOS Alert'}
                  </span>
                  {isQueued && (
                    <span className="text-[9px] font-black uppercase tracking-wider text-orange-400 bg-orange-400/10 border border-orange-400/20 px-2 py-0.5 rounded-full shrink-0">
                      Pending
                    </span>
                  )}
                </div>
                <p className="text-gray-500 text-[11px]">{formatDate(alert.timestamp)}</p>
                {alert.notes && (
                  <p className="text-gray-400 text-[11px] mt-1 truncate">{alert.notes}</p>
                )}
              </div>

              {/* Method badge + arrow */}
              <div className="flex flex-col items-end gap-2 shrink-0">
                <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${method.color}`}>
                  {method.label}
                </span>
                <span className="material-symbols-outlined text-gray-600 text-lg">chevron_right</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Detail Modal */}
      {selectedAlert && (
        <div className="absolute inset-0 z-[5000] bg-black/60 backdrop-blur-sm flex items-end">
          <div className="w-full bg-[#0f141e] border-t border-gray-800 rounded-t-3xl overflow-y-auto max-h-[85vh] animate-in slide-in-from-bottom duration-300">

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800/50 sticky top-0 bg-[#0f141e] z-10">
              <div>
                <h3 className="text-white font-bold text-lg">Alert Details</h3>
                <p className="text-gray-500 text-[11px]">{formatDate(selectedAlert.timestamp)}</p>
              </div>
              <button
                onClick={() => setSelectedAlert(null)}
                className="w-10 h-10 bg-gray-800/50 rounded-full flex items-center justify-center text-gray-400 hover:text-white active:scale-95"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="px-6 py-5 flex flex-col gap-5">

              {/* Status row */}
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${getStatusColor(selectedAlert.status)}`} />
                <span className="text-white text-sm font-bold capitalize">{selectedAlert.status.replace(/_/g, ' ')}</span>
                <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ml-auto ${getMethodBadge(selectedAlert.transmission_method).color}`}>
                  {getMethodBadge(selectedAlert.transmission_method).label}
                </span>
              </div>

              {/* GPS section */}
              <section>
                <h4 className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-3">Location</h4>
                <div className="bg-gray-800/40 border border-gray-700/50 rounded-2xl p-4 grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-gray-500 text-[9px] font-bold uppercase tracking-wider mb-1">Latitude</p>
                    <p className="text-blue-400 text-xs font-mono font-bold">
                      {selectedAlert.latitude?.toFixed(4) ?? 'N/A'}°
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-[9px] font-bold uppercase tracking-wider mb-1">Longitude</p>
                    <p className="text-blue-400 text-xs font-mono font-bold">
                      {selectedAlert.longitude?.toFixed(4) ?? 'N/A'}°
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-[9px] font-bold uppercase tracking-wider mb-1">Altitude</p>
                    <p className="text-blue-400 text-xs font-mono font-bold">
                      {selectedAlert.altitude?.toFixed(0) ?? 'N/A'} m
                    </p>
                  </div>
                </div>
              </section>

              {/* Device section */}
              <section>
                <h4 className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-3">Device</h4>
                <div className="bg-gray-800/40 border border-gray-700/50 rounded-2xl p-4 flex items-center gap-4">
                  <span className="material-symbols-outlined text-gray-400">battery_5_bar</span>
                  <div>
                    <p className="text-gray-500 text-[9px] font-bold uppercase tracking-wider">Battery at alert time</p>
                    <p className="text-white text-sm font-bold mt-0.5">{selectedAlert.battery_level ?? 'N/A'}%</p>
                  </div>
                  <div className="ml-auto">
                    <p className="text-gray-500 text-[9px] font-bold uppercase tracking-wider">Source</p>
                    <p className={`text-xs font-bold mt-0.5 ${selectedAlert.source === 'remote' ? 'text-green-400' : 'text-orange-400'}`}>
                      {selectedAlert.source === 'remote' ? 'Synchronized' : 'Local only'}
                    </p>
                  </div>
                </div>
              </section>

              {/* Notes section */}
              {selectedAlert.notes && (
                <section>
                  <h4 className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-3">Notes</h4>
                  <div className="bg-gray-800/40 border border-gray-700/50 rounded-2xl p-4">
                    <p className="text-white text-sm leading-relaxed">{selectedAlert.notes}</p>
                  </div>
                </section>
              )}

              {/* Medical section */}
              <section>
                <h4 className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-3">Medical Data at Alert Time</h4>
                <div className="bg-gray-800/40 border border-gray-700/50 rounded-2xl overflow-hidden">

                  <div className="flex items-center justify-between p-4 border-b border-gray-700/30">
                    <span className="text-gray-400 text-sm">Name</span>
                    <span className="text-white text-sm font-bold">
                      {selectedAlert.first_name && selectedAlert.last_name
                        ? `${selectedAlert.first_name} ${selectedAlert.last_name}`
                        : 'Unknown'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-4 border-b border-gray-700/30">
                    <span className="text-gray-400 text-sm">Blood Type</span>
                    <span className="text-red-400 font-bold text-sm bg-red-400/10 px-3 py-1 rounded-full">
                      {selectedAlert.blood_type || 'N/A'}
                    </span>
                  </div>

                  {[
                    { label: 'Allergies', value: selectedAlert.allergies },
                    { label: 'Conditions', value: selectedAlert.medical_conditions },
                    { label: 'Current Condition', value: selectedAlert.current_condition },
                  ].map((field) => (
                    <div key={field.label} className="flex flex-col gap-1 p-4 border-b border-gray-700/30 last:border-0">
                      <span className="text-gray-400 text-sm">{field.label}</span>
                      <span className="text-white text-sm font-medium">{field.value || 'None'}</span>
                    </div>
                  ))}
                </div>
              </section>

              <div className="h-4" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}