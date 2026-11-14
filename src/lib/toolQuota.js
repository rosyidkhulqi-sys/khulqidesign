// Daily allowance for Remove background: Free 5 a day, Premium unlimited.
// A signed-in account is counted by the database (tool_quota / use_tool), so
// it can't be reset from the browser. A visitor without an account may try it
// too (no wall before use); their count is kept in this browser.
// Days are UTC, the same as the database.
import { supabase } from "./supabaseClient";

export const FREE_CUTOUTS = 5;
const TOOL = "remove_background";

export class DailyLimitError extends Error {
  constructor(limit) {
    super(`You've used your ${limit} free background removals for today. Premium removes backgrounds without a limit.`);
    this.code = "daily_limit";
  }
}

const today = () => new Date().toISOString().slice(0, 10);
const LOCAL_KEY = "kd-cutouts";

function localUsed() {
  try {
    const kept = JSON.parse(localStorage.getItem(LOCAL_KEY) || "null");
    return kept?.day === today() ? kept.used : 0;
  } catch {
    return 0;
  }
}

async function signedIn() {
  const { data } = await supabase.auth.getSession();
  return Boolean(data.session);
}

// { used, limit } for today; limit null = no limit
export async function cutoutQuota() {
  if (!(await signedIn())) return { used: localUsed(), limit: FREE_CUTOUTS };
  const { data, error } = await supabase.rpc("tool_quota", { p_tool: TOOL });
  if (error) throw error;
  return data;
}

// before running: throws DailyLimitError when today's allowance is used up
export async function checkCutout() {
  const q = await cutoutQuota();
  if (q.limit != null && q.used >= q.limit) throw new DailyLimitError(q.limit);
  return q;
}

// after a successful run: counts it and returns the new { used, limit }
export async function countCutout() {
  if (!(await signedIn())) {
    const used = localUsed() + 1;
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify({ day: today(), used }));
    } catch {
      /* private window: nothing to keep */
    }
    return { used, limit: FREE_CUTOUTS };
  }
  const { data, error } = await supabase.rpc("use_tool", { p_tool: TOOL });
  if (error) {
    if (/daily_limit/.test(error.message)) throw new DailyLimitError(FREE_CUTOUTS);
    throw error;
  }
  return data;
}

// "3 of 5 left today", or null when there's no limit
export const quotaLabel = (q) =>
  q && q.limit != null ? `${Math.max(0, q.limit - q.used)} of ${q.limit} free left today` : null;
