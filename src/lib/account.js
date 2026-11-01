// Display name and avatar for a Supabase user (Google sign-in provides both).
export function accountInfo(user) {
  const meta = user?.user_metadata ?? {};
  const name = meta.full_name || meta.name || user?.email?.split("@")[0] || "Account";
  return { name, email: user?.email, avatar: meta.avatar_url, initial: name[0].toUpperCase() };
}
