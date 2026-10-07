const { test } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { createResolver } = require("../index.js");

test("ordinary notes have no lock and text flags do not accidentally mark notes", async () => {
  const resolve = createResolver({ defaultPassword: "example only", notePasswords: "{}" });
  assert.equal(await resolve("/public/", false), null);
  assert.equal(await resolve("/public/", "false"), null);
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

test("invalid settings and missing passwords fail visibly", async () => {
  await assert.rejects(createResolver({ notePasswords: "not json" })("/note/", false), /valid JSON/);
  await assert.rejects(createResolver({ notePasswords: "[]" })("/note/", false), /JSON object/);
  await assert.rejects(createResolver({ notePasswords: '{}', defaultPassword: "" })("/note/", true), /no password/);
  await assert.rejects(createResolver({ notePasswords: '{"https://example.com/":"example"}' })("/note/", false), /published paths/);
});
