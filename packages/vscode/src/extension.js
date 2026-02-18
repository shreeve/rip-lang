const vscode = require('vscode');
const path = require('path');
const fs = require('fs');

// Tailwind CSS IntelliSense — to enable autocompletion for Tailwind classes
// inside .() CLSX helpers in Rip render templates, add these to your VS Code
// or Cursor user/workspace settings:
//
//   "tailwindCSS.includeLanguages": { "rip": "html" },
//   "tailwindCSS.experimental.classRegex": [
//     ["\\.\\(([\\s\\S]*?)\\)", "'([^']*)'"]
//   ]

let outputChannel;
let compiler = null;    // lazy-loaded Rip compiler module
let shadowCache = {};   // filePath → { code, reverseMap, shadowUri }
let debounceTimers = {}; // filePath → timer for debounced compilation
const debug = false;     // set to true for verbose output logging

// ============================================================================
// Compiler Loading
// ============================================================================

// Load the Rip compiler module (ESM) for in-process compilation
async function loadCompiler() {
  if (compiler) return compiler;

  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) return null;

  for (const folder of workspaceFolders) {
    const root = folder.uri.fsPath;
    // Check for compiler in development repo
    const devCompiler = path.join(root, 'src', 'compiler.js');
    if (fs.existsSync(devCompiler)) {
      try {
        compiler = await import(devCompiler);
        outputChannel.appendLine('Loaded Rip compiler (development)');
        return compiler;
      } catch (e) {
        outputChannel.appendLine(`Failed to load dev compiler: ${e.message}`);
      }
    }
    // Check for compiler in node_modules
    const npmCompiler = path.join(root, 'node_modules', 'rip-lang', 'src', 'compiler.js');
    if (fs.existsSync(npmCompiler)) {
      try {
        compiler = await import(npmCompiler);
        outputChannel.appendLine('Loaded Rip compiler (npm)');
        return compiler;
      } catch (e) {
        outputChannel.appendLine(`Failed to load npm compiler: ${e.message}`);
      }
    }
  }
  return null;
}

// ============================================================================
// Shadow .ts File Management
// ============================================================================

function getShadowDir() {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) return null;
  return path.join(workspaceFolders[0].uri.fsPath, '.rip-cache');
}

function getShadowPath(ripFilePath) {
  const shadowDir = getShadowDir();
  if (!shadowDir) return null;
  const workRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
  const relative = path.relative(workRoot, ripFilePath).replace(/\.rip$/, '.ts');
  return path.join(shadowDir, relative);
}

function ensureShadowDir(shadowPath) {
  const dir = path.dirname(shadowPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// Write tsconfig.json for the shadow directory so TypeScript resolves node_modules
function ensureTsConfig() {
  const shadowDir = getShadowDir();
  if (!shadowDir) return;
  const tsConfigPath = path.join(shadowDir, 'tsconfig.json');
  if (fs.existsSync(tsConfigPath)) return;

  ensureShadowDir(tsConfigPath);
  const config = {
    compilerOptions: {
      target: 'ESNext',
      module: 'ESNext',
      moduleResolution: 'node',
      baseUrl: '..',
      strict: false,
      noEmit: true,
      skipLibCheck: true,
      allowJs: true,
    },
    include: ['./**/*.ts'],
  };
  fs.writeFileSync(tsConfigPath, JSON.stringify(config, null, 2));
  outputChannel.appendLine('Created .rip-cache/tsconfig.json');
}

// Compile .rip source to shadow .ts file and build reverse map
async function updateShadow(document) {
  const comp = await loadCompiler();
  if (!comp) return null;

  const filePath = document.uri.fsPath;
  const source = document.getText();
  const shadowPath = getShadowPath(filePath);
  if (!shadowPath) return null;

  try {
    const result = comp.compile(source, { sourceMap: true });
    const code = result.code;
    const reverseMap = result.reverseMap;

    // Write shadow .ts file
    ensureShadowDir(shadowPath);
    fs.writeFileSync(shadowPath, code);

    const shadowUri = vscode.Uri.file(shadowPath);
    const entry = { code, reverseMap, shadowUri };
    shadowCache[filePath] = entry;

    return entry;
  } catch (e) {
    // Compilation errors are expected while typing — silently ignore
    return shadowCache[filePath] || null;
  }
}

// ============================================================================
// Position Mapping
// ============================================================================

// Map a position in .rip source to the corresponding position in shadow .ts
function mapToGenerated(filePath, position) {
  const entry = shadowCache[filePath];
  if (!entry || !entry.reverseMap) return null;

  const mapping = entry.reverseMap.get(position.line);
  if (!mapping) {
    // No exact line match — find the closest preceding mapped line
    let closest = null;
    for (const [origLine, pos] of entry.reverseMap) {
      if (origLine <= position.line) {
        if (!closest || origLine > closest.origLine) {
          closest = { origLine, ...pos };
        }
      }
    }
    if (closest) {
      // Estimate: same relative column offset on the generated line
      return new vscode.Position(closest.genLine, position.character);
    }
    return null;
  }

  return new vscode.Position(mapping.genLine, position.character);
}

// ============================================================================
// Level 1: .d.ts Generation — writes directly to .rip-cache/
// ============================================================================

function getShadowDtsPath(ripFilePath) {
  const shadowDir = getShadowDir();
  if (!shadowDir) return null;
  const workRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
  const relative = path.relative(workRoot, ripFilePath).replace(/\.rip$/, '.d.ts');
  return path.join(shadowDir, relative);
}

async function generateDts(filePath) {
  const comp = await loadCompiler();
  if (!comp) return false;

  try {
    const source = fs.readFileSync(filePath, 'utf-8');
    const result = comp.compile(source);
    if (!result.dts) return false;

    const shadowDtsPath = getShadowDtsPath(filePath);
    if (!shadowDtsPath) return false;

    ensureShadowDir(shadowDtsPath);
    fs.writeFileSync(shadowDtsPath, result.dts);
    const rel = path.relative(vscode.workspace.workspaceFolders[0].uri.fsPath, filePath);
    outputChannel.appendLine(`Generated ${rel.replace(/\.rip$/, '.d.ts')} → .rip-cache/`);
    return true;
  } catch (e) {
    if (debug) outputChannel.appendLine(`Error generating .d.ts for ${path.basename(filePath)}: ${e.message}`);
    return false;
  }
}

// ============================================================================
// Level 2: Type Intelligence Providers
// ============================================================================

// Completion provider — proxies to TypeScript via shadow .ts file
const completionProvider = {
  async provideCompletionItems(document, position, token, context) {
    if (!vscode.workspace.getConfiguration('rip').get('types.intellisense')) return null;
    const entry = await updateShadow(document);
    if (!entry) return null;

    const tsPos = mapToGenerated(document.uri.fsPath, position);
    if (!tsPos) return null;

    if (debug) outputChannel.appendLine(`Completion: .rip(${position.line},${position.character}) → .ts(${tsPos.line},${tsPos.character})`);

    try {
      const items = await vscode.commands.executeCommand(
        'vscode.executeCompletionItemProvider',
        entry.shadowUri,
        tsPos
      );
      if (debug) outputChannel.appendLine(`Completion: ${items?.items?.length ?? items?.length ?? 0} items`);
      return items;
    } catch {
      return null;
    }
  }
};

// Hover provider — proxies to TypeScript via shadow .ts file
const hoverProvider = {
  async provideHover(document, position) {
    if (!vscode.workspace.getConfiguration('rip').get('types.intellisense')) return null;
    const entry = await updateShadow(document);
    if (!entry) return null;

    const tsPos = mapToGenerated(document.uri.fsPath, position);
    if (!tsPos) return null;

    try {
      const hovers = await vscode.commands.executeCommand(
        'vscode.executeHoverProvider',
        entry.shadowUri,
        tsPos
      );
      if (hovers && hovers.length > 0) return hovers[0];
    } catch {}
    return null;
  }
};

// Definition provider — proxies to TypeScript via shadow .ts file
const definitionProvider = {
  async provideDefinition(document, position) {
    if (!vscode.workspace.getConfiguration('rip').get('types.intellisense')) return null;
    const entry = await updateShadow(document);
    if (!entry) return null;

    const tsPos = mapToGenerated(document.uri.fsPath, position);
    if (!tsPos) return null;

    try {
      const locations = await vscode.commands.executeCommand(
        'vscode.executeDefinitionProvider',
        entry.shadowUri,
        tsPos
      );
      return locations;
    } catch {}
    return null;
  }
};

// ============================================================================
// Extension Lifecycle
// ============================================================================

function activate(context) {
  outputChannel = vscode.window.createOutputChannel('Rip');
  outputChannel.appendLine('Rip extension activated');

  // Initialize shadow directory and tsconfig
  ensureTsConfig();

  // Level 1: Generate .d.ts on save (written directly to .rip-cache/)
  const saveWatcher = vscode.workspace.onDidSaveTextDocument(async (document) => {
    if (document.languageId !== 'rip') return;
    const config = vscode.workspace.getConfiguration('rip');
    if (config.get('types.generateOnSave')) {
      const filePath = document.uri.fsPath;
      outputChannel.appendLine(`Saved: ${path.basename(filePath)}`);
      await generateDts(filePath);
    }
  });

  // Level 2: Update shadow .ts on edit (debounced, for type intelligence)
  const editWatcher = vscode.workspace.onDidChangeTextDocument((event) => {
    if (event.document.languageId !== 'rip') return;
    const config = vscode.workspace.getConfiguration('rip');
    if (!config.get('types.intellisense')) return;

    const filePath = event.document.uri.fsPath;
    if (debounceTimers[filePath]) clearTimeout(debounceTimers[filePath]);
    debounceTimers[filePath] = setTimeout(() => {
      delete debounceTimers[filePath];
      updateShadow(event.document);
    }, 300);
  });

  // Level 2: Register type intelligence providers
  const completionReg = vscode.languages.registerCompletionItemProvider('rip', completionProvider, '.');
  const hoverReg = vscode.languages.registerHoverProvider('rip', hoverProvider);
  const definitionReg = vscode.languages.registerDefinitionProvider('rip', definitionProvider);

  // Commands
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

  context.subscriptions.push(
    saveWatcher, editWatcher,
    completionReg, hoverReg, definitionReg,
    generateCmd, generateAllCmd,
    outputChannel
  );
}

function deactivate() {
  for (let timer of Object.values(debounceTimers)) clearTimeout(timer);
  debounceTimers = {};
  shadowCache = {};
}

module.exports = { activate, deactivate };
