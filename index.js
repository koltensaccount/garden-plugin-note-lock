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
    // Validate during rendering so invalid settings fail the build visibly.
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
    eleventyConfig.on("eleventy.before", () => { resolve = createResolver(context.settings); });
    // The garden's slot renderer uses synchronous Nunjucks for-loops.
    eleventyConfig.addFilter("gpNoteLock", (path, locked) => resolve(path, locked));
  },
  createResolver
};
