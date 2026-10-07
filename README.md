# Note Lock (Casual Privacy) for Digital Garden

**This is not encryption or secure access control.** It adds a theme-matched
password screen to discourage casual reading. Content remains in the downloaded
HTML and may also appear in search, RSS, embeds, attachments, caches and earlier
deployments. A visitor can bypass the screen with developer tools. Do not use
this for confidential notes.

Install this repository URL using Digital Garden's **Install from GitHub** menu.
No modifications to Digital Garden's Obsidian plugin are needed. No build step
or dependency installation is required for this plugin's source files.

## Configure

In the garden plugin menu, open **Note Lock (Casual Privacy)** and set
**Password for locked notes** to a unique passphrase. In Obsidian, mark a note:

```yaml
lock: true
```

Keep `dg-publish: true` when publishing. Use `lock` as a checkbox property,
not text. Do **not** put a real password in a note's `password` property.
Digital Garden publishes custom note properties.

For individual passwords, set **Per-note passwords (JSON)** in the plugin menu:

```json
{"/private-note/":"a unique passphrase", "/another-note/":"a different passphrase"}
```

Use the published URL path, including any folder names. These rules automatically
lock the matching pages without needing a `lock` property. Use `/` for the home
page if it is a garden entry. Trailing slashes are optional. Passwords are exact
and case-sensitive; surrounding spaces are part of the password.

Save settings and publish/redeploy the garden. Reopening a page requires its
password again; entered passwords are not stored in browser storage. Disabling
or uninstalling this plugin removes the lock on the next deployment.

**Show file browser while locked** is off by default. Enable it to keep the
garden's existing file/tag browser and mobile navigation available alongside
the lock. Useful when the locked note is the homepage. The note and right TOC
remain hidden. File-browser resizing, collapse/reopen and theme switching keep
working. Search, TOC and print buttons are hidden while locked and return after
unlocking. This honors Digital Garden's existing file-browser setting and does
not create a second browser or modify core files or other plugins.

Off keeps the full-page screen with navigation hidden. This does not prevent
direct visits to other URLs; mark other notes as locked too if you want the
same casual-privacy screen on them.

## Limitations

Passwords are stored as plaintext in the garden plugin configuration in your
source repository. The standard plugin manager's text inputs are not masked.
Keep the repository private; anyone with repository or build-system access can
read the configured passwords. Public plugin source contains no passwords.

At build time, random per-page salts and PBKDF2-SHA256 (600,000 iterations)
produce verifiers; this plugin emits only verifiers, not the configured plaintext
passwords, to site pages. Verifiers can still be attacked offline by guessing.
Strong, unique passphrases help but do not protect the already-readable content.
Other plugins can expose their own copies of settings or content; this plugin
does not audit them. HTTPS and Web Crypto support are required for password entry.

A marked note without a configured password or malformed JSON stops rendering
with a configuration error. As with any garden plugin, disabling the plugin or
failure to load its hook removes its protection. This is a convenience screen,
not a security boundary.

## Development

```sh
npm run check
npm test
npm run install:garden -- /path/to/my-digital-garden
```

Update both version fields for releases. Digital Garden installs the latest
GitHub release when present, otherwise the default branch. Do not commit real
passwords or fixtures with private content to this plugin repository.
