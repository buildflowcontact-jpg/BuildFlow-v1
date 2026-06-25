import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import type { Profile, Organization } from '@/types/domain';

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  organization: Organization | null;
  initializing: boolean;
  setSession: (session: Session | null) => void;
  setProfile: (profile: Profile | null) => void;
  setOrganization: (organization: Organization | null) => void;
  setInitializing: (value: boolean) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  profile: null,
  organization: null,
  initializing: true,
  setSession: (session) => set({ session }),
  setProfile: (profile) => set({ profile }),
  setOrganization: (organization) => set({ organization }),
  setInitializing: (value) => set({ initializing: value }),
  reset: () => set({ session: null, profile: null, organization: null }),
}));
