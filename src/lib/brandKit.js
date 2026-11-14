// A Premium member's brand kit: official colors, heading and body fonts, and
// logos, kept with their account (table brand_kits). Only Premium members can
// save one; the database checks that too, not just the page.
import { supabase } from "./supabaseClient";

export const MAX_COLORS = 12;
export const MAX_LOGOS = 6;
// a logo is stored inside the kit, so it must stay small
export const MAX_LOGO_BYTES = 400 * 1024;

export const emptyKit = { colors: [], headingFont: null, bodyFont: null, logos: [] };

export async function fetchBrandKit(userId) {
  const { data, error } = await supabase
    .from("brand_kits")
    .select("colors, heading_font, body_font, logos")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return emptyKit;
  return { colors: data.colors ?? [], headingFont: data.heading_font, bodyFont: data.body_font, logos: data.logos ?? [] };
}

export async function saveBrandKit(userId, kit) {
  const { error } = await supabase.from("brand_kits").upsert({
    user_id: userId,
    colors: kit.colors.slice(0, MAX_COLORS),
    heading_font: kit.headingFont,
    body_font: kit.bodyFont,
    logos: kit.logos.slice(0, MAX_LOGOS),
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}
