// Writes src/data/openSource.json: every library the website ships (the
// "dependencies" in package.json) with its version, license, author and
// source link, read from its own package.json. Runs before each build
// ("prebuild"), so the License page's list never falls out of date.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

// a git address as a page people can open
const pageOf = (repo) => {
  if (!repo) return null;
  let url = typeof repo === "string" ? repo : repo.url;
  if (!url) return null;
  if (/^[\w-]+\/[\w.-]+$/.test(url)) url = `https://github.com/${url}`;
  return url.replace(/^git\+/, "").replace(/^git:\/\//, "https://").replace(/\.git$/, "");
};

const libraries = Object.keys(pkg.dependencies).sort().map((name) => {
  const lib = JSON.parse(fs.readFileSync(path.join(root, "node_modules", name, "package.json"), "utf8"));
  const author = typeof lib.author === "string" ? lib.author : lib.author?.name;
  return {
    name,
    version: lib.version,
    license: lib.license ?? "See source",
    author: author ? author.replace(/\s*<[^>]*>/, "").replace(/\s*\([^)]*\)/, "") : null,
    url: lib.homepage?.startsWith("http") ? lib.homepage : pageOf(lib.repository),
  };
});

fs.writeFileSync(path.join(root, "src/data/openSource.json"), JSON.stringify(libraries, null, 2) + "\n");
console.log(`open-source: ${libraries.length} libraries`);
