const crypto = require("node:crypto");
const ITERATIONS = 600000;

function normalizePath(value) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    throw new Error("Note Lock: keys must be published paths such as /private-note/.");
  }
  const url = new URL(value, "https://garden.invalid");
  if (url.search || url.hash) throw new Error("Note Lock: paths cannot contain queries or fragments.");
  return url.pathname.replace(/\/+$/, "") || "/";
}

function readOverrides(raw) {
  let parsed;
  try { parsed = JSON.parse(raw || "{}"); }
  catch (_) { throw new Error("Note Lock: per-note passwords must be a valid JSON object."); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Note Lock: per-note passwords must be a JSON object mapping paths to passwords.");
  }
  const result = new Map();
  for (const [path, password] of Object.entries(parsed)) {
    if (typeof password !== "string" || !password.length) {
      throw new Error("Note Lock: every configured password must be a non-empty string.");
    }
    const key = normalizePath(path);
    if (result.has(key)) throw new Error("Note Lock: duplicate normalized note paths.");
    result.set(key, password);
  }
  return result;
}

function safeJson(value) {
  return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, character => "\\u" + character.charCodeAt(0).toString(16).padStart(4, "0"));
}

function createResolver(settings) {
  const cache = new Map();
  return function resolve(path, locked) {
    // Eleventy also renders the unused landing template with permalink: false.
    if (path === false || path === undefined || path === null) return null;
    // Validate during rendering; the template filter catches errors and locks visibly.
    const overrides = readOverrides(settings.notePasswords);
    const key = normalizePath(path);
    const explicit = overrides.has(key);
    if (!explicit && locked !== true) return null;
    const password = explicit ? overrides.get(key) : settings.defaultPassword;
    if (typeof password !== "string" || !password.length) {
      throw new Error("Note Lock: a note has lock: true but no password is configured in the plugin settings.");
    }
    if (!cache.has(key)) cache.set(key, (() => {
      const salt = crypto.randomBytes(16);
      const verifier = crypto.pbkdf2Sync(password, salt, ITERATIONS, 32, "sha256");
      return safeJson({ version: 1, salt: salt.toString("base64"), verifier: verifier.toString("base64"), iterations: ITERATIONS, showFileBrowser: settings.showFileBrowser === true });
    })());
    return cache.get(key);
  };
}

module.exports = {
  setupEleventy(eleventyConfig, context) {
    let resolve = createResolver(context.settings);
    const protectedPaths = new Set();
    let overrides;
    try { overrides = readOverrides(context.settings.notePasswords); } catch (_) { overrides = new Map(); }
    for (const key of overrides.keys()) protectedPaths.add(key);
    if (eleventyConfig.addCollection) eleventyConfig.addCollection("gpNoteLockPaths", api => {
      for (const item of api.getAll()) {
        const props = item.data && item.data["dg-note-properties"];
        if (item.url && (props && props.lock === true || item.data && item.data.lock === true)) protectedPaths.add(normalizePath(item.url));
      }
      return [];
    });
    if (eleventyConfig.addTransform) eleventyConfig.addTransform("gp-note-lock-discovery", function (content, outputPath) {
      return filterDiscovery(content, outputPath || this.outputPath, protectedPaths, context.settings);
    });
    eleventyConfig.on("eleventy.before", () => { resolve = createResolver(context.settings); });
    // The garden's slot renderer uses synchronous Nunjucks for-loops.
    eleventyConfig.addFilter("gpNoteLock", (path, locked) => {
      try { return resolve(path, locked); }
      catch (_) {
        console.warn("[note-lock] Check the password configuration; affected pages show a configuration lock.");
        return safeJson({ version: 1, configurationError: true, showFileBrowser: false });
      }
    });
  },
  createResolver,
  filterDiscovery
};

function filterDiscovery(content, outputPath, protectedPaths, settings) {
  const target = String(outputPath || "").replace(/\\/g, "/");
  const locked = url => {
    try { return protectedPaths.has(normalizePath(new URL(url, "https://garden.invalid").pathname)); }
    catch (_) { return false; }
  };
  if (target.endsWith("/searchIndex.json") && settings.excludeLockedFromSearch !== false) {
    const entries = JSON.parse(content);
    if (Array.isArray(entries)) return JSON.stringify(entries.filter(entry => !locked(entry.url)));
  }
  if (target.endsWith("/feed.xml") && settings.excludeLockedFromFeed !== false && content.trim()) {
    // node-html-parser is shipped by the current garden; keep Atom links self-closing.
    const { parse } = require("node-html-parser");
    const root = parse(content, { lowerCaseTagName: false, comment: true, voidTag: { tags: ["link"], closingSlash: true } });
    root.querySelectorAll("entry").forEach(entry => {
      const link = entry.querySelector("link");
      const id = entry.querySelector("id");
      if (locked(link && link.getAttribute("href") || id && id.textContent)) entry.remove();
    });
    return root.toString();
  }
  return content;
}
