// Create editor elements: single SVG or PNG files, read straight from
// public/trial-elements/<category>/<file>. Drop a file into a category folder
// and it shows up in Create; the folder name becomes the category.
//
// Only the file list is read here (Object.keys), so no file is bundled: the
// build keeps just the paths. Later the backend serves the same list, with
// thousands of elements, page by page.

const paths = Object.keys(import.meta.glob("/public/trial-elements/*/*.{svg,png,SVG,PNG}"));

const label = (text) =>
  text.replace(/[-_]+/g, " ").replace(/^\w/, (c) => c.toUpperCase());

export const elements = paths
  .map((path) => {
    // "/public/trial-elements/stickers/happy-sun.svg"
    const [, , , folder, file] = path.split("/");
    return {
      id: path,
      url: `/trial-elements/${encodeURIComponent(folder)}/${encodeURIComponent(file)}`,
      type: file.toLowerCase().endsWith(".svg") ? "svg" : "png",
      category: folder,
      name: label(file.replace(/\.(svg|png)$/i, "")),
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

// categories in name order, each with its elements
export const elementCategories = [...new Set(elements.map((e) => e.category))]
  .sort()
  .map((id) => ({
    id,
    name: label(id),
    items: elements.filter((e) => e.category === id),
  }));
