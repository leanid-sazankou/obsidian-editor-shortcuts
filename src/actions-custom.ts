import type {
  Editor,
  EditorChange,
  EditorRangeOrCaret,
  EditorSelection,
} from 'obsidian';

/*
 * Self-contained copy of the two word-navigation actions, written in the
 * "new" action approach: actions are pure functions that return document
 * changes plus the cursor's new position, and a wrapper applies them all in a
 * single `editor.transaction` (so multi-cursor updates are grouped and undo
 * behaves as expected). Nothing here is imported from the original
 * `main.ts` / `actions.ts`.
 */

type EditorActionCallbackNewArgs = Record<string, any>;

type EditorActionCallbackNew = (
  editor: Editor,
  selection: EditorSelection,
  args: EditorActionCallbackNewArgs,
) => { changes: EditorChange[]; newSelection: EditorRangeOrCaret };

/**
 * Runs a new-style action once per cursor/selection and commits every result
 * in one transaction. Copied (and trimmed) from the original utils so this
 * file has no dependency on the rest of the codebase.
 */
export const withMultipleSelectionsNew = (
  editor: Editor,
  callback: EditorActionCallbackNew,
) => {
  const selections = editor.listSelections();
  const newSelections: EditorRangeOrCaret[] = [];
  const changes: EditorChange[] = [];

  for (let i = 0; i < selections.length; i++) {
    const { changes: newChanges, newSelection } = callback(
      editor,
      selections[i],
      { iteration: i },
    );
    changes.push(...newChanges);
    newSelections.push(newSelection);
  }

  editor.transaction({
    changes,
    selections: newSelections,
  });
};

// Match any Unicode letter (with combining marks) or digit.
const isWordChar = (char: string) => /[\p{L}\p{M}\d]/u.test(char);

/**
 * Computes the offset of the next word boundary using classic forward-word /
 * backward-word semantics: skip any separators, then skip the word itself.
 * Newlines count as separators, so navigation crosses line boundaries.
 */
const nextWordOffset = (
  doc: string,
  offset: number,
  direction: 'left' | 'right',
): number => {
  let pos = offset;
  if (direction === 'right') {
    while (pos < doc.length && !isWordChar(doc.charAt(pos))) pos++;
    while (pos < doc.length && isWordChar(doc.charAt(pos))) pos++;
  } else {
    while (pos > 0 && !isWordChar(doc.charAt(pos - 1))) pos--;
    while (pos > 0 && isWordChar(doc.charAt(pos - 1))) pos--;
  }
  return pos;
};

const moveWord =
  (direction: 'left' | 'right'): EditorActionCallbackNew =>
  (editor, selection) => {
    const doc = editor.getValue();
    const fromOffset = editor.posToOffset(selection.head);
    const toOffset = nextWordOffset(doc, fromOffset, direction);
    return {
      changes: [],
      newSelection: { from: editor.offsetToPos(toOffset) },
    };
  };

export const goToNextWord = moveWord('right');

export const goToPreviousWord = moveWord('left');

const selectWord =
  (direction: 'left' | 'right'): EditorActionCallbackNew =>
  (editor, selection) => {
    const doc = editor.getValue();
    const headOffset = nextWordOffset(
      doc,
      editor.posToOffset(selection.head),
      direction,
    );
    return {
      changes: [],
      // Keep the existing anchor and move only the head by a word, so the
      // selection extends (or shrinks) word by word.
      newSelection: {
        from: selection.anchor,
        to: editor.offsetToPos(headOffset),
      },
    };
  };

export const selectToNextWord = selectWord('right');

export const selectToPreviousWord = selectWord('left');

/**
 * Deletes back to the previous word boundary for each cursor (or deletes the
 * current selection if there is one), in a single transaction. No selections
 * are passed to the transaction so the editor maps each cursor through the
 * deletions itself — this keeps multi-cursor and undo behaviour correct.
 */
export const deleteWordBackward = (editor: Editor) => {
  const doc = editor.getValue();
  const changes: EditorChange[] = [];

  for (const selection of editor.listSelections()) {
    const headOffset = editor.posToOffset(selection.head);
    const anchorOffset = editor.posToOffset(selection.anchor);
    let from: number;
    let to: number;
    if (headOffset !== anchorOffset) {
      // Non-empty selection: delete it, like a normal backspace.
      from = Math.min(headOffset, anchorOffset);
      to = Math.max(headOffset, anchorOffset);
    } else {
      // Collapsed cursor: delete back to the previous word boundary.
      from = nextWordOffset(doc, headOffset, 'left');
      to = headOffset;
    }
    if (to > from) {
      changes.push({
        from: editor.offsetToPos(from),
        to: editor.offsetToPos(to),
        text: '',
      });
    }
  }

  if (changes.length === 0) {
    return;
  }
  changes.sort((a, b) => a.from.line - b.from.line || a.from.ch - b.from.ch);
  editor.transaction({ changes });
};
