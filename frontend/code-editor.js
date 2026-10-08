import {EditorState, Compartment} from '@codemirror/state';
import {EditorView, keymap, lineNumbers, highlightActiveLineGutter, Decoration, ViewPlugin} from '@codemirror/view';
import {defaultKeymap, history, historyKeymap, indentWithTab} from '@codemirror/commands';
import {cpp} from '@codemirror/lang-cpp';
import {foldGutter, codeFolding, foldKeymap, bracketMatching, indentUnit, syntaxHighlighting, HighlightStyle} from '@codemirror/language';
import {tags} from '@lezer/highlight';

const colors = HighlightStyle.define([
  {tag: tags.keyword, color: '#c792ea'},
  {tag: [tags.typeName, tags.className], color: '#e5c07b'},
  {tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: '#61afef'},
  {tag: [tags.string, tags.character], color: '#98c379'},
  {tag: [tags.number, tags.bool], color: '#d19a66'},
  {tag: tags.comment, color: '#767d8b', fontStyle: 'italic'},
  {tag: [tags.operator, tags.punctuation], color: '#aeb5c2'},
  {tag: tags.meta, color: '#e5c07b'},
]);

// Render guides only inside the indentation, not behind the rest of the code.
const guides = ViewPlugin.fromClass(class {
  constructor(view) { this.decorations = this.build(view); }
  update(update) {
    if (update.docChanged || update.viewportChanged) this.decorations = this.build(update.view);
  }
  build(view) {
    const lines = new Set();
    const decorations = [];
    for (const {from, to} of view.visibleRanges) {
      for (let pos = from; pos <= to;) {
        const line = view.state.doc.lineAt(pos);
        if (!lines.has(line.from)) {
          lines.add(line.from);
          let whitespace = line.text.match(/^[\t ]*/)[0];
          // Continue visual guides through blank lines inside blocks.
          if (!line.text.trim()) {
            for (let n = line.number + 1; n <= Math.min(view.state.doc.lines, line.number + 20); n++) {
              const next = view.state.doc.line(n).text;
              if (next.trim()) { whitespace = next.match(/^[\t ]*/)[0]; break; }
            }
          }
          let columns = 0;
          for (const char of whitespace) columns += char === '\t' ? 4 - columns % 4 : 1;
          if (columns > 0) decorations.push(Decoration.line({
            attributes: {class: 'cm-indent-guides', style: `--indent-columns:${columns}ch`}
          }).range(line.from));
        }
        pos = line.to + 1;
      }
    }
    return Decoration.set(decorations, true);
  }
}, {decorations: value => value.decorations});

export function createCodeEditor(parent, code, onChange) {
  const mode = new Compartment();
  const editable = enabled => [EditorState.readOnly.of(!enabled), EditorView.editable.of(enabled)];
  const extensions = [
        cpp(), lineNumbers(), foldGutter(), codeFolding(), bracketMatching(), guides,
        history(), highlightActiveLineGutter(), indentUnit.of('    '), EditorState.tabSize.of(4),
        keymap.of([...defaultKeymap, ...historyKeymap, ...foldKeymap, indentWithTab]),
        syntaxHighlighting(colors), mode.of(editable(false)),
        EditorView.contentAttributes.of({'aria-label': 'C++ solution', 'tabindex': '0'}),
        EditorView.updateListener.of(update => { if (update.docChanged) onChange(view.state.doc.toString()); }),
        EditorView.theme({
          '&': {height: '100%', backgroundColor: 'transparent', color: '#d4d7de'},
          '.cm-scroller': {fontFamily: "'SF Mono', 'Cascadia Code', Menlo, Consolas, monospace", fontSize: '13px', lineHeight: '1.8', overflow: 'auto'},
          '.cm-content': {padding: '18px 0', caretColor: '#74b7ff', minHeight: '100%'},
          '.cm-line': {padding: '0 18px 0 8px'},
          '.cm-gutters': {backgroundColor: 'transparent', color: '#59606d', border: 'none', paddingRight: '6px'},
          '.cm-gutterElement': {fontSize: '11px'},
          '.cm-activeLineGutter': {backgroundColor: 'rgba(255,255,255,.04)', color: '#a8afbc'},
          '.cm-foldGutter .cm-gutterElement': {cursor: 'pointer', padding: '0 3px'},
          '.cm-foldPlaceholder': {backgroundColor: '#ffffff0b', color: '#9aa6bb', border: '1px solid #ffffff12', borderRadius: '4px', padding: '0 6px'},
          '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': {backgroundColor: '#264d79 !important'},
          '&.cm-focused': {outline: 'none'},
          '.cm-matchingBracket': {backgroundColor: '#ffffff16', outline: '1px solid #ffffff30'},
        }, {dark: true}),
      ];
  const view = new EditorView({parent, state: EditorState.create({doc: code || '', extensions})});
  return {
    setEditable(enabled) { view.dispatch({effects: mode.reconfigure(editable(enabled))}); },
    setValue(value) { if (view.state.doc.toString() !== value) view.dispatch({changes: {from: 0, to: view.state.doc.length, insert: value}}); },
    reset(value) {
      view.setState(EditorState.create({doc: value || '', extensions}));
      view.scrollDOM.scrollTop = 0; view.scrollDOM.scrollLeft = 0;
    },
    getValue() { return view.state.doc.toString(); },
    focus() { view.focus(); },
    destroy() { view.destroy(); },
  };
}
