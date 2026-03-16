import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://example.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'public-anon-key';

export const hasSupabaseEnv = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Types for database
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'runner' | 'club_owner';
  created_at: string;
}

export interface Club {
  id: string;
  owner_id: string;
  name: string;
  description: string;
  image_url?: string;
  created_at: string;
}

export interface Run {
  id: string;
  club_id: string;
  date: string;
  time: string;
  distance: string;
  pace_range: string;
  location: string;
  created_at: string;
}

export interface RunRSVP {
  id: string;
  run_id: string;
  user_id: string;
  status: 'attending' | 'maybe' | 'declined';
  created_at: string;
}

export interface ClubMember {
  id: string;
  club_id: string;
  user_id: string;
  joined_at: string;
}
