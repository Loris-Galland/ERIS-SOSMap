/*
 * Supabase client singleton for the ERIS Safety app.
 * Initialises and exports a single SupabaseClient instance using the Vite
 * environment variables VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY. Throws
 * at startup if either variable is missing. Imported by App.tsx (auth), feature
 * hooks, and services that need real-time database access or remote storage.
 */
import { createClient } from '@supabase/supabase-js';

// Retrieve environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Throw an error if variables are missing to prevent silent failures
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables. Check your app/.env file.");
}

// Initialize the Supabase client for remote database and authentication
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
