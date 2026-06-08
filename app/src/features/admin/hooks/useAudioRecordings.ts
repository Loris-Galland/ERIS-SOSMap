/*
 * Fetches all emergency audio recordings from Supabase for admin inspection.
 * Generates a 1-hour signed URL for each file so the admin can play or download
 * without exposing the bucket directly.
 */

import { useState, useEffect } from 'react';
import { supabase } from '../../../db/supabaseClient';

export interface AudioRecordingAdmin {
  id: string;
  user_id: string;
  trigger_type: 'fall' | 'crash' | 'shake' | 'discrete' | 'manual';
  duration_seconds: number;
  file_path: string;
  created_at: string;
  expires_at: string;
  alert_id?: string | null;
  signedUrl?: string;
}

export function useAudioRecordings() {
  const [recordings, setRecordings] = useState<AudioRecordingAdmin[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);

  const fetchRecordings = async () => {
    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from('emergency_recordings')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }

    // Attach a signed URL (1 hour TTL) so the admin can stream or download directly
    const withUrls = await Promise.all(
      (data as AudioRecordingAdmin[]).map(async (rec) => {
        const { data: urlData } = await supabase.storage
          .from('emergency_recordings')
          .createSignedUrl(rec.file_path, 3_600);
        return { ...rec, signedUrl: urlData?.signedUrl ?? undefined };
      }),
    );

    setRecordings(withUrls);
    setLoading(false);
  };

  useEffect(() => { fetchRecordings(); }, []);

  return { recordings, loading, error, refetch: fetchRecordings };
}
