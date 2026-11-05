// auth.js – Appwrite authentication functions
import { account, ID } from './appwriteClient.js';

// Sign up new user
export async function signUp(email, password) {
  try {
    const user = await account.create(ID.unique(), email, password);
    // Cria sessão automaticamente após cadastro
    await account.createEmailPasswordSession(email, password);
    return { user };
  } catch (error) {
    throw error;
  }
}

// Log in existing user
export async function logIn(email, password) {
  try {
    const session = await account.createEmailPasswordSession(email, password);
    const user = await account.get();
    return { session, user };
  } catch (error) {
    throw error;
  }
}

// Password recovery (send reset email)
export async function recoverPassword(email) {
  try {
    const redirectUrl = window.location.origin + window.location.pathname.replace(/\/[^\/]*$/, '/') + 'recuperar-senha.html';
    const response = await account.createRecovery(email, redirectUrl);
    return response;
  } catch (error) {
    throw error;
  }
}
