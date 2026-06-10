const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const { LanguageClient, TransportKind } = require('vscode-languageclient/node');

// Tailwind CSS IntelliSense — configured automatically via configurationDefaults
// in package.json. Covers .() CLSX helpers and class: attributes in .rip files.
// If you need to customize, override tailwindCSS.experimental.classRegex in your
// user/workspace settings.

let client;

// VS Code only auto-linkifies URLs (with a scheme) in comments — not relative
// paths. This provider makes relative-path references in .rip *comments*
// clickable (e.g. `# see ../NOTES.md#section-3`). A `#anchor` jumps to the
// matching section — `#section-3` finds the "3." heading; an `id="..."`/`name="..."`
// HTML anchor also works. Only real files become links.
function relativePathLinkProvider() {
  // ./ or ../ prefix, a path with an extension, optional #anchor.
  const PATTERN = /(\.\.?\/[\w./-]+\.\w+)(#[\w-]+)?/g;
  return {
    provideDocumentLinks(document) {
      const links = [];
      const dir = path.dirname(document.uri.fsPath);
      for (let lineNo = 0; lineNo < document.lineCount; lineNo++) {
        const line = document.lineAt(lineNo).text;
        const commentStart = findCommentStart(line);
        if (commentStart < 0) continue; // not a comment line → skip
        const comment = line.slice(commentStart);
        for (const m of comment.matchAll(PATTERN)) {
          const relPath = m[1];
          const frag = m[2];
          const target = path.resolve(dir, relPath);
          if (!fs.existsSync(target)) continue;
          let uri = vscode.Uri.file(target);
          if (frag) {
            const ln = anchorLine(target, frag.slice(1));
            if (ln >= 0) uri = uri.with({ fragment: `L${ln + 1}` });
          }
          const col = commentStart + m.index;
          const range = new vscode.Range(lineNo, col, lineNo, col + m[0].length);
          const link = new vscode.DocumentLink(range, uri);
          link.tooltip = `Open ${relPath}${frag || ''}`;
          links.push(link);
        }
      }
      return links;
    },
  };
}

// Index of the first `#` that begins a line comment — i.e. a `#` that isn't
// inside a string (handles "...", '...', `...`, and `#{}` interpolation).
// Returns -1 when the line has no comment.
function findCommentStart(line) {
  let inStr = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inStr) {
      if (c === '\\') { i++; continue; }
      if (c === inStr) inStr = null;
    } else if (c === '"' || c === "'" || c === '`') {
      inStr = c;
    } else if (c === '#') {
      return i;
    }
  }
  return -1;
}

// Resolve a fragment to a 0-based line in the target file: a `#section-3` anchor
// maps to the heading that starts with "3."; an `id="..."`/`name="..."` HTML
// anchor also resolves. Returns -1 if not found.
function anchorLine(file, anchor) {
  let lines;
  try { lines = fs.readFileSync(file, 'utf8').split('\n'); } catch { return -1; }
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(`id="${anchor}"`) || lines[i].includes(`name="${anchor}"`)) return i;
  }
  const numbered = /^gap-(\d+)$/.exec(anchor);
  if (numbered) {
    const heading = new RegExp(`^#{1,6}\\s+${numbered[1]}\\.`);
    for (let i = 0; i < lines.length; i++) {
      if (heading.test(lines[i])) return i;
    }
  }
  return -1;
}

async function activate(context) {
  const outputChannel = vscode.window.createOutputChannel('Rip');
  outputChannel.appendLine('Rip extension activated');

  const serverModule = path.join(context.extensionPath, 'dist', 'lsp.js');

  const serverOptions = {
    run: { command: 'bun', args: [serverModule], transport: TransportKind.stdio },
    debug: { command: 'bun', args: [serverModule], transport: TransportKind.stdio },
  };

  const clientOptions = {
    documentSelector: [{ language: 'rip' }],
    outputChannel,
  };

  client = new LanguageClient('rip', 'Rip Language Server', serverOptions, clientOptions);
  client.start();

  context.subscriptions.push(
    outputChannel,
    vscode.languages.registerDocumentLinkProvider({ language: 'rip' }, relativePathLinkProvider()),
  );
}

function deactivate() {
  if (client) return client.stop();
}

module.exports = { activate, deactivate };
