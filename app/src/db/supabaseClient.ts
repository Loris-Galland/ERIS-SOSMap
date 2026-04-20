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