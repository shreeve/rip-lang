// ============================================================================
// Rip Print — VS Code extension for syntax-highlighted source code printing
//
// Author: Steve Shreeve (steve.shreeve@gmail.com)
//   Date: Feb 10, 2026
// ============================================================================

const vscode = require('vscode');
const path   = require('path');
const fs     = require('fs');
const os     = require('os');
const { generatePrintHtml, generateMarkdownHtml, walkDir } = require('./printer');

// ============================================================================
// Activation
// ============================================================================

function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand('rip-print.printFile', handlePrintFile),
    vscode.commands.registerCommand('rip-print.printFolder', handlePrintFolder)
  );
}

// ============================================================================
// Command handlers
// ============================================================================

async function handlePrintFile(uri) {
  let filePath, code, mtime;

  if (uri && uri.fsPath) {
    filePath = uri.fsPath;
    // Use editor content if the file is open (may have unsaved changes)
    const doc = vscode.workspace.textDocuments.find(d => d.uri.fsPath === filePath);
    code = doc ? doc.getText() : fs.readFileSync(filePath, 'utf-8');
    try { mtime = fs.statSync(filePath).mtime; } catch { mtime = new Date(); }
  } else {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('No active file to print');
      return;
    }
    filePath = editor.document.uri.fsPath;
    code = editor.document.getText();
    try { mtime = fs.statSync(filePath).mtime; } catch { mtime = new Date(); }
  }

  if (!code) {
    vscode.window.showWarningMessage('File is empty');
    return;
  }

  const files = [{ file: path.basename(filePath), code, mtime }];
  openInBrowser(files);
}

async function handlePrintFolder(uri) {
  let dirPath;

  if (uri && uri.fsPath) {
    dirPath = uri.fsPath;
  } else {
    // No URI passed — prompt user to pick a folder
    const picked = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      openLabel: 'Print Folder',
    });
    if (!picked || picked.length === 0) return;
    dirPath = picked[0].fsPath;
  }

  const relPaths = walkDir(dirPath);
  if (relPaths.length === 0) {
    vscode.window.showWarningMessage('No printable files found in this folder');
    return;
  }

  const files = [];
  for (const relPath of relPaths) {
    const fullPath = path.join(dirPath, relPath);
    try {
      const code = fs.readFileSync(fullPath, 'utf-8');
      const mtime = fs.statSync(fullPath).mtime;
      files.push({ file: relPath, code, mtime });
    } catch {
      // Skip unreadable files
    }
  }

  if (files.length === 0) {
    vscode.window.showWarningMessage('No readable files found');
    return;
  }

  openInBrowser(files);
}

// ============================================================================
// Open in browser
// ============================================================================

function openInBrowser(files) {
  // Auto-detect dark mode from VS Code theme
  const themeKind = vscode.window.activeColorTheme.kind;
  const dark = themeKind === vscode.ColorThemeKind.Dark
            || themeKind === vscode.ColorThemeKind.HighContrastDark;

  // Single markdown file: render as a document via Bun, not as highlighted source.
  // Falls through to generatePrintHtml if Bun isn't available or the spawn fails.
  let html = null;
  if (files.length === 1 && files[0].file.toLowerCase().endsWith('.md')) {
    html = generateMarkdownHtml(files[0].file, files[0].code, { dark });
  }
  if (html === null) {
    html = generatePrintHtml(files, { dark });
  }

  // Write to temp file and open in default browser
  const tmpFile = path.join(os.tmpdir(), `rip-print-${Date.now()}.html`);
  fs.writeFileSync(tmpFile, html, 'utf-8');
  vscode.env.openExternal(vscode.Uri.file(tmpFile));
}

// ============================================================================
// Deactivation
// ============================================================================

function deactivate() {}

module.exports = { activate, deactivate };
