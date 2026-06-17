// Installs pjeby's Hot Reload dev plugin into an Obsidian vault and marks this
// plugin for watching, so saved builds reload automatically in Obsidian.
// Hot Reload is not in the community store, so it's cloned from GitHub.
//
// Usage:
//   yarn setup-hot-reload <path-to-vault>
//   OBSIDIAN_VAULT=<path-to-vault> yarn setup-hot-reload

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const HOT_RELOAD_REPO = 'https://github.com/pjeby/hot-reload';

const repoDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const vault = process.argv[2] ?? process.env.OBSIDIAN_VAULT;
if (!vault) {
  console.error(
    'Usage: yarn setup-hot-reload <path-to-vault>\n' +
      '   or: OBSIDIAN_VAULT=<path-to-vault> yarn setup-hot-reload',
  );
  process.exit(1);
}

// 1. Mark this plugin as "in development" so Hot Reload watches it. The plugin
// folder in the vault is a symlink to this repo (see `yarn link-vault`), so the
// marker file lives in the repo root.
writeFileSync(join(repoDir, '.hotreload'), '');
console.log('Created .hotreload marker in repo root.');

// 2. Clone (or update) Hot Reload into the vault's plugins folder.
const pluginsDir = resolve(vault, '.obsidian', 'plugins');
const hotReloadDir = join(pluginsDir, 'hot-reload');
mkdirSync(pluginsDir, { recursive: true });

try {
  if (existsSync(join(hotReloadDir, '.git'))) {
    console.log('Hot Reload already present — pulling latest...');
    execFileSync('git', ['-C', hotReloadDir, 'pull', '--ff-only'], {
      stdio: 'inherit',
    });
  } else {
    console.log(`Cloning Hot Reload into ${hotReloadDir} ...`);
    execFileSync('git', ['clone', HOT_RELOAD_REPO, hotReloadDir], {
      stdio: 'inherit',
    });
  }
} catch {
  console.error(
    '\nFailed to run git. Make sure git is installed and on your PATH.\n' +
      `You can also clone it manually:\n  git clone ${HOT_RELOAD_REPO} "${hotReloadDir}"`,
  );
  process.exit(1);
}

console.log(
  '\nDone. In Obsidian: enable both "Hot Reload" and this plugin under\n' +
    'Settings -> Community plugins. Saved builds will now reload automatically.',
);
