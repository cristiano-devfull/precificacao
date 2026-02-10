// auth.js – Supabase authentication functions
import { supabaseClient } from './supabaseClient.js';

// Sign up new user
export async function signUp(email, password) {
  const { data, error } = await supabaseClient.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

// Log in existing user
export async function logIn(email, password) {
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

// Password recovery (send reset email)
export async function recoverPassword(email) {
  const { data, error } = await supabaseClient.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + window.location.pathname.replace(/\/[^\/]*$/, '/') + 'recuperar-senha.html'
  });
  if (error) throw error;
  return data;
}
