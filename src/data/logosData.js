// Logo industries and styles, shared by the Logos page and /admin. The logos
// themselves are uploaded on /admin, in three licenses:
//   free       download now, credit required; draws visitors in
//   premium    non-exclusive: included with the subscription, many buyers
//              may use the same logo
//   exclusive  bought outright at a fixed price, by one buyer only; then it
//              is marked sold and no one else can buy it

// industries in the spirit of logo marketplaces such as Logoground; the
// ids are stored with each logo, so rename labels freely but keep the ids
export const industries = [
  ["agriculture", "Agriculture & farming"],
  ["architecture", "Architecture & interior"],
  ["art", "Art & design"],
  ["automotive", "Automotive"],
  ["beauty", "Beauty & salon"],
  ["business", "Business & consulting"],
  ["construction", "Construction & tools"],
  ["education", "Education"],
  ["energy", "Energy & industry"],
  ["entertainment", "Entertainment & events"],
  ["fashion", "Fashion & clothing"],
  ["finance", "Finance & law"],
  ["food", "Food & drink"],
  ["health", "Health & wellness"],
  ["kids", "Kids & family"],
  ["media", "Media & photography"],
  ["medical", "Medical & pharmacy"],
  ["music", "Music"],
  ["nature", "Nature & eco"],
  ["pets", "Pets & animals"],
  ["realestate", "Real estate"],
  ["religion", "Religion & community"],
  ["retail", "Retail & e-commerce"],
  ["science", "Science & research"],
  ["security", "Security"],
  ["sports", "Sports & fitness"],
  ["tech", "Tech & gaming"],
  ["transport", "Transport & logistics"],
  ["travel", "Travel & outdoor"],
];

export const logoStyles = [
  ["mascot", "Mascot"],
  ["badge", "Vintage badge"],
  ["line", "Line art"],
  ["monogram", "Monogram"],
  ["abstract", "Abstract"],
];

export const industryName = Object.fromEntries(industries);
export const styleName = Object.fromEntries(logoStyles);
