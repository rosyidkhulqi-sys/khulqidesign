// "3000 × 2000": a size as the asset view writes it
export const px = ([w, h]) => `${w} × ${h}`;

// the lowest tier price of an item sold per license tier (a font)
export const fromPrice = (prices) => {
  const list = Object.values(prices ?? {}).filter((p) => p > 0);
  return list.length ? Math.min(...list) : null;
};
