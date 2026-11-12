// Create trial elements: single SVG or PNG files, read from
// public/trial-elements/<category>/<file>. Legacy folder names are normalized
// to the same categories used by published assets.
//
// Only the file list is read here (Object.keys), so no file is bundled: the
// build keeps just the paths. Later the backend serves the same list, with
// thousands of elements, page by page.
import { normalizeElementCategory } from "./elementCategories";

const paths = Object.keys(import.meta.glob("/public/trial-elements/*/*.{svg,png,SVG,PNG}"));

const label = (text) =>
  text.replace(/[-_]+/g, " ").replace(/^\w/, (c) => c.toUpperCase());

const fileUrl = (folder, file) =>
  `/trial-elements/${encodeURIComponent(folder)}/${encodeURIComponent(file)}`;

// a "_cover.png" or "_cover.svg" in a folder is that category's picture in
// Browse categories; files starting with "_" are not elements
const covers = {};
paths.forEach((path) => {
  const [, , , folder, file] = path.split("/");
  if (/^_cover\.(svg|png)$/i.test(file)) covers[folder] = fileUrl(folder, file);
});

export const elements = paths
  .filter((path) => !path.split("/")[4].startsWith("_"))
  .map((path) => {
    // "/public/trial-elements/stickers/happy-sun.svg"
    const [, , , folder, file] = path.split("/");
    return {
      id: path,
      url: fileUrl(folder, file),
      type: file.toLowerCase().endsWith(".svg") ? "svg" : "png",
      category: normalizeElementCategory(folder),
      name: label(file.replace(/\.(svg|png)$/i, "")),
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

// categories in name order, each with its elements and a cover picture
// (its _cover file, else its first element)
export const elementCategories = [...new Set(elements.map((e) => e.category))]
  .sort()
  .map((id) => {
    const items = elements.filter((e) => e.category === id);
    return { id, name: label(id), items, cover: covers[id] ?? items[0].url };
  });
