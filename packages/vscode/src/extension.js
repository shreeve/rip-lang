const vscode = require('vscode');
const path = require('path');
const { LanguageClient, TransportKind } = require('vscode-languageclient/node');

// Tailwind CSS IntelliSense — to enable autocompletion for Tailwind classes
// inside .() CLSX helpers in Rip render templates, add these to your VS Code
// or Cursor user/workspace settings:
//
//   "tailwindCSS.includeLanguages": { "rip": "html" },
//   "tailwindCSS.experimental.classRegex": [
//     ["\\.\\(([\\s\\S]*?)\\)", "'([^']*)'"]
//   ]

let client;

async function activate(context) {
  const outputChannel = vscode.window.createOutputChannel('Rip');
  outputChannel.appendLine('Rip extension activated');

  const serverModule = path.join(context.extensionPath, 'dist', 'server.js');

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

  context.subscriptions.push(outputChannel);
}

function deactivate() {
  if (client) return client.stop();
}

module.exports = { activate, deactivate };
