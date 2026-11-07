// Trial icon data built from the SVGs in public/. Later this comes from the
// backend: every icon row has a set_id, and a set is a named group of icons.

// one icon set per style for now; a set always shares one style
export const iconSets = [
  {
    id: "shopping-promo",
    name: "Shopping & Promo",
    style: "outline",
    license: "free",
    description: "Line icons for stores, sales and checkout.",
  },
  {
    id: "online-payment",
    name: "Online Payment",
    style: "glyph",
    license: "premium",
    description: "Solid icons for e-commerce and wallets.",
  },
  {
    id: "store-people",
    name: "Store People",
    style: "flat",
    license: "free",
    description: "Colorful flat icons for shops and service.",
  },
  {
    id: "discount-gradient",
    name: "Discount Gradient",
    style: "gradient",
    license: "premium",
    description: "Gradient icons for vouchers and price tags.",
  },
];

// trial icons in public/trial-icons/; replaced by real assets later
const sampleIcons = [
  { name: "Barcode", src: "/trial-icons/barcode.svg", setId: "shopping-promo", tags: ["barcode", "scan", "product", "price", "shopping"] },
  { name: "Hot sale", src: "/trial-icons/hot%20sale.svg", setId: "shopping-promo", tags: ["sale", "discount", "fire", "promotion", "shopping"] },
  { name: "Pin", src: "/trial-icons/pin.svg", setId: "shopping-promo", tags: ["pin", "location", "map", "marker", "navigation"] },
  { name: "Promo", src: "/trial-icons/promo.svg", setId: "shopping-promo", tags: ["promo", "tag", "discount", "label", "offer"] },
  { name: "Cashier", src: "/trial-icons/cashier.svg", setId: "store-people", tags: ["cashier", "store", "payment", "shop", "checkout"] },
  { name: "E-commerce", src: "/trial-icons/ecommerce.svg", setId: "online-payment", tags: ["ecommerce", "online shop", "cart", "website", "shopping"] },
  { name: "Wallet", src: "/trial-icons/wallet%20icon.svg", setId: "online-payment", tags: ["wallet", "money", "payment", "finance", "cash"] },
  { name: "Coupon", src: "/trial-icons/coupon%202.svg", setId: "discount-gradient", tags: ["coupon", "voucher", "discount", "ticket", "sale"] },
  { name: "Discount", src: "/trial-icons/discount.svg", setId: "discount-gradient", tags: ["discount", "percent", "badge", "sale", "offer"] },
];

const setById = Object.fromEntries(iconSets.map((s) => [s.id, s]));

// the trial files repeat to fill the grid like a real library
const totalAssets = 200;

export const icons = Array.from({ length: totalAssets }, (_, index) => {
  const sample = sampleIcons[index % sampleIcons.length];
  const set = setById[sample.setId];
  return {
    id: index + 1,
    code: `KD-IC-${String(100000 + index * 11).padStart(6, "0")}`,
    name: sample.name,
    image: sample.src,
    keywords: [...sample.tags, "icon", set.style],
    category: ["business", "social", "ui", "holiday", "nature"][index % 5],
    style: set.style,
    setId: set.id,
    license: index % 3 === 0 ? "premium" : "free",
  };
});

// the first copy of each trial file stands for the real member of its set
const setMembers = Object.fromEntries(
  iconSets.map((set) => [
    set.id,
    icons.slice(0, sampleIcons.length).filter((icon) => icon.setId === set.id),
  ])
);

export const setOf = (icon) => setById[icon.setId] ?? null;
export const membersOf = (set) => setMembers[set.id] ?? [];
