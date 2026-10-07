const { test } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { createResolver } = require("../index.js");
const { filterDiscovery } = require("../index.js");

test('search and Atom exclude protected paths and retain unrelated entries; both options can be disabled', () => {
  const protectedPaths = new Set(['/locked-demonstration']);
  const search = JSON.stringify([{url:'/public/'},{url:'/locked-demonstration/',content:'private fixture'}]);
  assert.deepEqual(JSON.parse(filterDiscovery(search,'dist/searchIndex.json',protectedPaths,{})),[{url:'/public/'}]);
  assert.equal(filterDiscovery(search,'dist/searchIndex.json',protectedPaths,{excludeLockedFromSearch:false}),search);
  const feed = '<?xml version="1.0" encoding="utf-8"?><feed xmlns="http://www.w3.org/2005/Atom"><title>Garden</title><entry><title>Public</title><link href="https://example.com/public/"/><id>https://example.com/public/</id><content type="html">&lt;p&gt;Public&lt;/p&gt;</content></entry><entry><title>Private</title><link href="https://example.com/locked-demonstration/"/><id>https://example.com/locked-demonstration/</id></entry></feed>';
  const result = filterDiscovery(feed,'dist/feed.xml',protectedPaths,{});
  assert(!result.includes('<title>Private</title>'));
  assert(result.includes('<title>Public</title>'));
  assert(result.includes('&lt;p&gt;Public&lt;/p&gt;'));
  assert.equal(filterDiscovery(feed,'dist/feed.xml',protectedPaths,{excludeLockedFromFeed:false}),feed);
});

test("lock bootstrap and critical sidebar hiding are emitted in the document head", () => {
  const manifest = require("../garden-plugin.json");
  assert.equal(manifest.slots["common.head"], "templates/lock.njk");
  assert.equal(manifest.slots["common.header"], undefined);
  const template = fs.readFileSync(path.join(__dirname, "../templates/lock.njk"), "utf8");
  assert(template.includes("<style>"));
  assert(template.includes("body > :not(.dg-note-lock) *"));
  assert(template.includes("visibility: hidden !important"));
});

test("ordinary notes have no lock and text flags do not accidentally mark notes", async () => {
  const resolve = createResolver({ defaultPassword: "example only", notePasswords: "{}" });
  assert.equal(await resolve("/public/", false), null);
  assert.equal(await resolve("/public/", "false"), null);
  assert.equal(await resolve(false, false), null);
});

test("note rules and checkbox flag produce verifiers without plaintext passwords", async () => {
  const resolve = createResolver({ defaultPassword: "default example", notePasswords: JSON.stringify({ "/specific/": "override example" }) });
  for (const [url, locked, password] of [["/specific", false, "override example"], ["/marked/", true, "default example"]]) {
    const payload = await resolve(url, locked);
    assert(!payload.includes(password));
    const config = JSON.parse(payload);
    const derived = crypto.pbkdf2Sync(password, Buffer.from(config.salt, "base64"), config.iterations, 32, "sha256");
    assert.equal(derived.toString("base64"), config.verifier);
    assert.notEqual(crypto.pbkdf2Sync("wrong example", Buffer.from(config.salt, "base64"), config.iterations, 32, "sha256").toString("base64"), config.verifier);
  }
});

test("invalid settings and missing passwords fail visibly", () => {
  assert.throws(() => createResolver({ notePasswords: "not json" })("/note/", false), /valid JSON/);
  assert.throws(() => createResolver({ notePasswords: "[]" })("/note/", false), /JSON object/);
  assert.throws(() => createResolver({ notePasswords: '{}', defaultPassword: "" })("/note/", true), /no password/);
  assert.throws(() => createResolver({ notePasswords: '{"https://example.com/":"example"}' })("/note/", false), /published paths/);
});

test("file-browser access is opt-in and is carried in the page configuration", () => {
  for (const allowed of [false, true]) {
    const resolve = createResolver({ defaultPassword: "navigation test only", notePasswords: "{}", showFileBrowser: allowed });
    assert.equal(JSON.parse(resolve("/", true)).showFileBrowser, allowed);
  }
  const definition = require("../garden-plugin.json").settings.find(setting => setting.key === "showFileBrowser");
  assert.equal(definition.type, "boolean");
  assert.equal(definition.default, false);
});

test("hook registers a synchronous filter that emits the lock payload", () => {
  let filter;
  require("../index.js").setupEleventy({
    on() {},
    addFilter(name, callback) { assert.equal(name, "gpNoteLock"); filter = callback; }
  }, { settings: { defaultPassword: "", notePasswords: '{"/":"integration example"}' } });
  const value = filter("/", undefined);
  assert.equal(typeof value, "string");
  assert.equal(JSON.parse(value).iterations, 600000);
  assert(!value.includes("integration example"));
});
