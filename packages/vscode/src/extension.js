const vscode = require('vscode');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

// Find the rip compiler binary
function findRipCompiler() {
  const config = vscode.workspace.getConfiguration('rip');
  const configPath = config.get('compiler.path');
  if (configPath) return configPath;

  // Check workspace for rip binary (in priority order)
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (workspaceFolders) {
    for (const folder of workspaceFolders) {
      const root = folder.uri.fsPath;

      // Check bin/rip (development repo)
      const devBin = path.join(root, 'bin', 'rip');
      if (fs.existsSync(devBin)) return devBin;

      // Check node_modules/.bin/rip (npm install)
      const localBin = path.join(root, 'node_modules', '.bin', 'rip');
      if (fs.existsSync(localBin)) return localBin;
    }
  }

  // Fall back to global rip command
  return 'rip';
}

// Generate .d.ts file for a .rip file
function generateDts(filePath) {
  const ripBin = findRipCompiler();
  const dir = path.dirname(filePath);
  const base = path.basename(filePath, '.rip');
  const dtsPath = path.join(dir, `${base}.d.ts`);

  return new Promise((resolve, reject) => {
    exec(`${ripBin} -d "${filePath}"`, { cwd: dir }, (error, stdout, stderr) => {
      if (error) {
        // Only log real errors, not "no types to emit" cases
        if (stderr && !stderr.includes('no types')) {
          outputChannel.appendLine(`Error generating ${base}.d.ts: ${stderr}`);
        }
        resolve(false);
      } else {
        if (fs.existsSync(dtsPath)) {
          outputChannel.appendLine(`Generated ${path.relative(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || dir, dtsPath)}`);
        }
        resolve(true);
      }
    });
  });
}

let outputChannel;

function activate(context) {
  outputChannel = vscode.window.createOutputChannel('Rip');

  outputChannel.appendLine('Rip extension activated');

  // Generate .d.ts on save
  const saveWatcher = vscode.workspace.onDidSaveTextDocument(async (document) => {
    if (document.languageId !== 'rip') return;

    const config = vscode.workspace.getConfiguration('rip');
    if (!config.get('types.generateOnSave')) return;

    const filePath = document.uri.fsPath;
    outputChannel.appendLine(`Saved: ${path.basename(filePath)}`);
    await generateDts(filePath);
  });

  // Command: Generate .d.ts for current file
  const generateCmd = vscode.commands.registerCommand('rip.generateDts', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'rip') {
      vscode.window.showWarningMessage('Open a .rip file first');
      return;
    }

    const filePath = editor.document.uri.fsPath;
    vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: 'Generating .d.ts...' },
      async () => {
        const success = await generateDts(filePath);
        if (success) {
          vscode.window.showInformationMessage(`Generated ${path.basename(filePath, '.rip')}.d.ts`);
        } else {
          vscode.window.showWarningMessage('No types to emit (add :: annotations to your Rip code)');
        }
      }
    );
  });

  // Command: Generate .d.ts for all .rip files in workspace
  const generateAllCmd = vscode.commands.registerCommand('rip.generateAllDts', async () => {
    const files = await vscode.workspace.findFiles('**/*.rip', '**/node_modules/**');
    if (files.length === 0) {
      vscode.window.showInformationMessage('No .rip files found in workspace');
      return;
    }

    vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: `Generating .d.ts for ${files.length} files...` },
      async () => {
        let count = 0;
        for (const file of files) {
          const success = await generateDts(file.fsPath);
          if (success) count++;
        }
        vscode.window.showInformationMessage(`Generated ${count} .d.ts file${count !== 1 ? 's' : ''}`);
      }
    );
  });

  context.subscriptions.push(saveWatcher, generateCmd, generateAllCmd, outputChannel);
}

function deactivate() {}

module.exports = { activate, deactivate };
