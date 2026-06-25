import { supabase } from '@/lib/supabaseClient';
import { unwrap } from '@/lib/unwrap';
import type { Profile } from '@/types/domain';

export interface SignUpProfileData {
  firstName: string;
  lastName: string;
  jobTitle?: string;
  companyName?: string;
  phone?: string;
}

export const authService = {
  async signUp(email: string, password: string, profileData: SignUpProfileData) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: profileData.firstName,
          last_name: profileData.lastName,
          job_title: profileData.jobTitle || null,
          company_name: profileData.companyName || null,
          phone: profileData.phone || null,
        },
      },
    });
    if (error) throw error;
    return data;
  },

  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async sendPasswordReset(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
  },

  async updatePassword(newPassword: string) {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  },

  async getSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  },

  onAuthStateChange(callback: Parameters<typeof supabase.auth.onAuthStateChange>[0]) {
    return supabase.auth.onAuthStateChange(callback);
  },

  async getProfile(userId: string): Promise<Profile> {
    return unwrap(await supabase.from('profiles').select('*').eq('id', userId).single());
  },

  async updateProfile(userId: string, updates: Partial<Profile>): Promise<Profile> {
    return unwrap(
      await supabase.from('profiles').update(updates).eq('id', userId).select('*').single()
    );
  },
};
