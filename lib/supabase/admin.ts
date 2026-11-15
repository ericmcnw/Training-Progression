import { createClient } from "@supabase/supabase-js";
import { INVITED_FLAG } from "@/lib/auth-paths";

// Service-role client for managing invites. The key bypasses every Supabase
// policy, so this module must never be imported from client code.
function adminAuth() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } }).auth.admin;
}

export function invitesConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export type InvitedUser = { id: string; email: string; lastSignInAt: string | null };

const MAX_USERS = 500;

async function listAuthUsers() {
  const admin = adminAuth();
  if (!admin) return [];
  const { data, error } = await admin.listUsers({ page: 1, perPage: MAX_USERS });
  if (error) throw new Error(error.message);
  return data.users;
}

export async function listInvitedUsers(): Promise<InvitedUser[]> {
  const users = await listAuthUsers();
  return users
    .filter((user) => user.email && user.app_metadata?.[INVITED_FLAG] === true)
    .map((user) => ({ id: user.id, email: user.email!.toLowerCase(), lastSignInAt: user.last_sign_in_at ?? null }))
    .sort((a, b) => a.email.localeCompare(b.email));
}

export async function isEmailInvited(email: string) {
  if (!invitesConfigured()) return false;
  const invited = await listInvitedUsers();
  return invited.some((user) => user.email === email.toLowerCase());
}

export async function setInvited(email: string, invited: boolean) {
  const admin = adminAuth();
  if (!admin) throw new Error("Invites need SUPABASE_SERVICE_ROLE_KEY to be set.");
  const normalized = email.trim().toLowerCase();
  const existing = (await listAuthUsers()).find((user) => user.email?.toLowerCase() === normalized);

  if (existing) {
    const { error } = await admin.updateUserById(existing.id, {
      app_metadata: { ...existing.app_metadata, [INVITED_FLAG]: invited },
    });
    if (error) throw new Error(error.message);
    return;
  }
  if (!invited) return;

  const { error } = await admin.createUser({
    email: normalized,
    email_confirm: true,
    app_metadata: { [INVITED_FLAG]: true },
  });
  if (error) throw new Error(error.message);
}
