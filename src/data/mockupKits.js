// Mockups that have a kit for Create (scripts/mockup-kit), by their KD code.
// A kit lives at public-files/mockups/<code>/kit/; for a Premium mockup its
// base.jpg there carries the watermark, and the clean one sits at the same
// key in private-files, fetched only for a Premium download. Later the admin
// upload will mark this on the asset itself; until then, this list.
import { PUBLIC_URL } from "../lib/r2";

export const MOCKUP_KITS = new Set([
  "KD-MK-4643058", // cosmetic bottles on white marble
  "KD-MK-6499775", // cosmetic bottles on grey marble
  "KD-MK-4734808", // ceramic mug by a rainy window
  "KD-MK-1619140", // ceramic mug by a moody rainy window (free)
  "KD-MK-4108566", // kraft coffee branding set
  "KD-MK-3034186", // kraft coffee cup and business card
  "KD-MK-5357232", // kraft takeaway cup with card (free)
  "KD-MK-4830050", // kraft paper bag and stationery
  "KD-MK-7961826", // skincare bottles in three sizes
]);

export const hasMockupKit = (code) => MOCKUP_KITS.has(code);

// the kit folder's public address, ending in "/"
export const mockupKitUrl = (code) => `${PUBLIC_URL}/mockups/${code}/kit/`;

// the clean base's key in private-files (Premium downloads only)
export const mockupCleanBaseKey = (code) => `mockups/${code}/kit/base.jpg`;
