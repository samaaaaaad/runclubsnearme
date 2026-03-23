import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const SUPABASE_ENV_ERROR =
  'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your deployment environment.';

// Some embedded/browser contexts block the Web Locks API (navigator.locks).
// Provide a custom auth lock to avoid LockManager errors during sign-in.
const authLock = async <T>(_name: string, _acquireTimeout: number, fn: () => Promise<T>): Promise<T> => {
  return await fn();
};

const fallbackStorage = new Map<string, string>();

const safeStorage = {
  getItem(key: string): string | null {
    if (typeof window === 'undefined') {
      return fallbackStorage.get(key) ?? null;
    }

    try {
      return window.localStorage.getItem(key);
    } catch {
      return fallbackStorage.get(key) ?? null;
    }
  },
  setItem(key: string, value: string): void {
    if (typeof window === 'undefined') {
      fallbackStorage.set(key, value);
      return;
    }

    try {
      window.localStorage.setItem(key, value);
    } catch {
      fallbackStorage.set(key, value);
    }
  },
  removeItem(key: string): void {
    if (typeof window === 'undefined') {
      fallbackStorage.delete(key);
      return;
    }

    try {
      window.localStorage.removeItem(key);
    } catch {
      fallbackStorage.delete(key);
    }
  },
};

const createMissingEnvClient = () => {
  return new Proxy(
    {},
    {
      get() {
        throw new Error(SUPABASE_ENV_ERROR);
      },
    }
  );
};

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        lock: authLock,
        storage: safeStorage,
      },
    })
  : (createMissingEnvClient() as ReturnType<typeof createClient>);

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
  owner_id: string | null;
  name: string;
  description: string | null;
  location?: string | null;
  schedule_day?: string | null;
  schedule_time?: string | null;
  lat?: number | null;
  lng?: number | null;
  image_url?: string | null;
  created_at: string;
}

export interface Run {
  id: string;
  club_id: string;
  date: string;
  time: string;
  is_recurring_weekly?: boolean | null;
  distance: string | null;
  pace_range: string | null;
  location: string | null;
  created_at: string;
}

export interface ClubEvent {
  id: string;
  club_id: string;
  title: string;
  description: string | null;
  event_date: string;
  event_time: string;
  location: string | null;
  created_by: string;
  created_at: string;
}

export interface ClubEventParticipant {
  id: string;
  event_id: string;
  user_id: string;
  created_at: string;
}

export interface ClubOwnerApplication {
  id: string;
  user_id: string;
  club_id: string;
  status: 'pending' | 'approved' | 'rejected';
  phone: string | null;
  experience_level: string | null;
  preferred_run_days: string | null;
  preferred_run_time: string | null;
  proposed_location: string | null;
  instagram_handle: string | null;
  website_url: string | null;
  notes: string | null;
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
