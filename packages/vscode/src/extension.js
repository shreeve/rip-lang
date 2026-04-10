const vscode = require('vscode');
const path = require('path');
const { LanguageClient, TransportKind } = require('vscode-languageclient/node');

// Tailwind CSS IntelliSense — configured automatically via configurationDefaults
// in package.json. Covers .() CLSX helpers and class: attributes in .rip files.
// If you need to customize, override tailwindCSS.experimental.classRegex in your
// user/workspace settings.

let client;

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
    vscode.commands.registerCommand('rip.toggleDebug', async () => {
      const config = vscode.workspace.getConfiguration('rip');
      const current = config.get('debug', false);
      await config.update('debug', !current, vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage(`Rip debug logging ${!current ? 'enabled' : 'disabled'}`);
    }),
  );
}

function deactivate() {
  if (client) return client.stop();
}

module.exports = { activate, deactivate };
