import { MarkdownView, Plugin } from 'obsidian';
import {
  deleteWordBackward,
  goToNextWord,
  goToPreviousWord,
  selectToNextWord,
  selectToPreviousWord,
  withMultipleSelectionsNew,
} from './actions-custom';

/*
 * Custom word-wise editing for this fork — a minimal, self-contained plugin.
 *
 * Shortcuts (Cmd on macOS / Ctrl on Windows & Linux; all repeat while held):
 *   - Cmd/Ctrl + Left/Right          move the cursor word by word
 *   - Cmd/Ctrl + Shift + Left/Right  extend the selection word by word
 *   - Cmd/Ctrl + Backspace           delete the previous word
 *
 * WHY A KEYDOWN LISTENER INSTEAD OF OBSIDIAN COMMANDS
 * Obsidian command hotkeys do NOT fire on OS key auto-repeat, so a *held*
 * shortcut falls through to CodeMirror's native Cmd+Arrow binding (move to
 * line start/end) — the cursor appears to jump to the end of the line. A raw
 * capture-phase DOM keydown listener fires on every repeat and calls
 * preventDefault, so holding steps word by word and the native motion is
 * suppressed. Capture phase is required so we run before CodeMirror's own
 * keydown handler.
 *
 * TRADE-OFF (deliberate): because no commands are registered, this plugin has
 * no per-plugin Hotkeys button, no command-palette entries, and the keys are
 * NOT rebindable from Obsidian's settings UI. Do not "fix" the missing Hotkeys
 * button by adding `addCommand` — that reintroduces the held-key bug. To change
 * the trigger keys, edit the `key` / `metaKey || ctrlKey` checks in
 * `handleWordNav` below.
 *
 * OBSIDIAN VERSION CONSTRAINTS (API types pinned at 0.12.17): there is no
 * `registerEditorExtension` (so a CodeMirror keymap extension isn't an option),
 * and `registerDomEvent(document, ...)` takes no listener-options argument.
 * Hence the listener is attached directly via `addEventListener(..., true)` and
 * removed via `this.register` on unload.
 *
 * The word actions live in ./actions-custom.ts (self-contained — nothing is
 * imported from the original main.ts / actions.ts), each using the "new" action
 * approach. Move/select return `{ changes, newSelection }` applied through
 * `withMultipleSelectionsNew`; delete builds `changes` and commits them in a
 * single `editor.transaction` without passing selections, letting the editor
 * map the cursors through the deletions itself.
 *
 * BUILD: esbuild's `start` / `build` scripts bundle src/main-custom.ts →
 * main.js (see package.json).
 */
export default class CustomWordNavigation extends Plugin {
  async onload() {
    // Capture phase is required so we run before CodeMirror's own keydown
    // handler. registerDomEvent (in this Obsidian version) doesn't accept
    // listener options, so register the listener directly and clean it up via
    // this.register on unload.
    document.addEventListener('keydown', this.handleWordNav, true);
    this.register(() =>
      document.removeEventListener('keydown', this.handleWordNav, true),
    );
  }

  private handleWordNav = (evt: KeyboardEvent) => {
    const { key } = evt;
    if (key !== 'ArrowRight' && key !== 'ArrowLeft' && key !== 'Backspace') {
      return;
    }
    // Cmd on macOS / Ctrl elsewhere. Alt is left to native handling.
    const hasMod = evt.metaKey || evt.ctrlKey;
    if (!hasMod || evt.altKey) {
      return;
    }
    // Only act when the keystroke originates inside an editor.
    const target = evt.target as HTMLElement | null;
    if (!target?.closest('.cm-editor')) {
      return;
    }
    const editor = this.app.workspace.getActiveViewOfType(MarkdownView)?.editor;
    if (!editor) {
      return;
    }
    // Take over from CodeMirror's native line-boundary motion/deletion.
    evt.preventDefault();
    evt.stopPropagation();
    if (key === 'Backspace') {
      // Cmd/Ctrl + Backspace: delete the previous word.
      deleteWordBackward(editor);
    } else {
      // Shift extends the selection by word; otherwise the cursor moves by word.
      const forward = key === 'ArrowRight';
      const action = evt.shiftKey
        ? forward
          ? selectToNextWord
          : selectToPreviousWord
        : forward
          ? goToNextWord
          : goToPreviousWord;
      withMultipleSelectionsNew(editor, action);
    }
    const cursor = editor.getCursor('head');
    editor.scrollIntoView({ from: cursor, to: cursor });
  };
}
