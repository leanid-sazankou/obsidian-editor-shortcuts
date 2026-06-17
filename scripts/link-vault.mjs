// Cross-platform helper to load the locally-built plugin in Obsidian without
// publishing. Symlinks this repo into a vault's `.obsidian/plugins/<id>` folder
// so `main.js`, `manifest.json` and `styles.css` are picked up live.
//
// Usage:
//   yarn link-vault <path-to-vault>
//   OBSIDIAN_VAULT=<path-to-vault> yarn link-vault
//
// Uses a directory junction on Windows (no admin rights required) and a normal
// symlink on macOS/Linux — the `type` argument to symlinkSync is ignored on
// POSIX platforms.

import { readFileSync, mkdirSync, symlinkSync, rmSync, lstatSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const vault = process.argv[2] ?? process.env.OBSIDIAN_VAULT;
if (!vault) {
  console.error(
    'Usage: yarn link-vault <path-to-vault>\n' +
      '   or: OBSIDIAN_VAULT=<path-to-vault> yarn link-vault',
  );
  process.exit(1);
}

const { id } = JSON.parse(readFileSync(join(repoDir, 'manifest.json'), 'utf8'));
const pluginsDir = resolve(vault, '.obsidian', 'plugins');
const linkPath = join(pluginsDir, id);

mkdirSync(pluginsDir, { recursive: true });

// Make re-running safe: remove a previous link, but never delete a real folder
// (it could contain the plugin's data.json settings).
let existing;
try {
  existing = lstatSync(linkPath);
} catch (err) {
  if (err.code !== 'ENOENT') throw err;
}
if (existing) {
  if (existing.isSymbolicLink()) {
    rmSync(linkPath, { recursive: true, force: true });
  } else {
    console.error(
      `Refusing to overwrite existing non-symlink folder:\n  ${linkPath}\n` +
        'Remove or back it up manually, then re-run.',
    );
    process.exit(1);
  }
}

symlinkSync(repoDir, linkPath, 'junction');

console.log(`Linked plugin "${id}":\n  ${linkPath}\n  -> ${repoDir}`);
console.log('Next: run `yarn start`, then enable the plugin in Obsidian.');
