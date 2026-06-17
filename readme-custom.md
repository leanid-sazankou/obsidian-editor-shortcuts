# Custom additions

Local-development tooling for running this fork in Obsidian without publishing.

## Added

- **`scripts/link-vault.mjs`** + `yarn link-vault <vault>` — cross-platform symlink of this repo into `<vault>/.obsidian/plugins/<id>` (directory junction on Windows, no admin needed).
- **`scripts/setup-hot-reload.mjs`** + `yarn setup-hot-reload <vault>` — clones pjeby's Hot Reload (not in the community store) into the vault and writes a `.hotreload` marker so saved builds reload automatically.
- **`.gitignore`** — ignore the `.hotreload` marker.

## Dev workflow

```sh
yarn link-vault       /path/to/vault   # link plugin into the vault
yarn setup-hot-reload /path/to/vault   # install Hot Reload + mark for watching
yarn start                             # esbuild watch — rebuilds on save
```

Then enable **Hot Reload** and **Code Editor Shortcuts** in Settings → Community plugins.
Edit → save → auto-rebuild → auto-reload.

Both commands also accept the vault via the `OBSIDIAN_VAULT` env var.
