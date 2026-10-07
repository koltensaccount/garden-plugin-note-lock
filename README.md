# Note Lock (Casual Privacy)

A client-side password screen for casual privacy with optional navigation and search/feed filtering; not encryption or secure access control.

![Note Lock (Casual Privacy) in a Digital Garden](screenshot.png)

## Installation

In Obsidian: Settings > Digital Garden > Plugins > Manage plugins > Browse & install. Until listed in the community gallery, use Install from GitHub with `koltensaccount/garden-plugin-note-lock`. A garden with current plugin support is required. Installation is file copying only; no setup scripts or dependencies need to run on the garden. Save settings and let the site rebuild.

## Usage

Configure a shared password in the manager and set lock: true on notes, or configure URL-to-password JSON overrides. Keep the garden source private: configured passwords are stored there. The client receives salted PBKDF2 verifiers, but content is still present in HTML, embeds, attachments and older caches. Optional search/feed filtering removes known locked entries, not every possible disclosure. Do not use sensitive/reused passwords. Misconfiguration shows an owner-facing configuration lock instead of breaking the build. Show file browser while locked is off by default.

## Settings

| Key | Setting | Default |
| --- | --- | --- |
| `showFileBrowser` | Show file browser while locked | false |
| `defaultPassword` | Password for locked notes | "" |
| `notePasswords` | Per-note passwords (JSON) | "{}" |
| `excludeLockedFromSearch` | Exclude locked notes from search | true |
| `excludeLockedFromFeed` | Exclude locked notes from RSS | true |

## Compatibility and Accessibility

Works alone and with the other reading plugins. Shared footer controls use the neutral `dg-nav-tools` convention, with a floating fallback when navigation is absent. Each plugin ships the helper it needs; none imports another plugin. Current Digital Garden uses full-document navigation. Initialization is idempotent. Native controls, accessible labels, focus outlines and appropriate ARIA states are retained. Print styles remain separate from screen preferences. Browser storage failures fall back safely.

## Development

Node 22+; `npm ci`, `npm run check`, `npm test`. Tests use Node's test runner and Playwright's driver with an installed Chrome/Edge browser (`CHROME_PATH` overrides discovery). CI uses Ubuntu's Chrome. Browser tests never invoke an OS print dialog. The plugin files are ready to copy directly into `src/plugins/note-lock/` in a current test garden. Real upstream integration and combination checks are reported in `VALIDATION.md`.

## License

MIT, copyright 2026 Kolten Bendickson.
