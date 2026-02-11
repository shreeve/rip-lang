// ============================================================================
// printer.js — Core print logic: syntax highlighting and HTML generation
//
// Ported from print.rip for use in the VS Code extension.
// ============================================================================

const hljs = require('highlight.js');
const fs   = require('fs');
const path = require('path');

// Register Rip language
const ripLanguage = require('../lib/hljs-rip');
hljs.registerLanguage('rip', ripLanguage);

// ============================================================================
// Language detection
// ============================================================================

const extToLang = {
  rip:    'rip',
  coffee: 'coffeescript',
  js:     'javascript',
  mjs:    'javascript',
  cjs:    'javascript',
  ts:     'typescript',
  mts:    'typescript',
  cts:    'typescript',
  jsx:    'javascript',
  tsx:    'typescript',
  rb:     'ruby',
  py:     'python',
  rs:     'rust',
  go:     'go',
  sh:     'bash',
  bash:   'bash',
  zsh:    'bash',
  fish:   'fish',
  yml:    'yaml',
  yaml:   'yaml',
  json:   'json',
  jsonc:  'json',
  md:     'markdown',
  html:   'html',
  htm:    'html',
  xml:    'xml',
  css:    'css',
  scss:   'scss',
  sass:   'scss',
  less:   'less',
  sql:    'sql',
  c:      'c',
  h:      'c',
  cpp:    'cpp',
  hpp:    'cpp',
  zig:    'zig',
  toml:   'toml',
  ini:    'ini',
  dockerfile: 'dockerfile',
  makefile:   'makefile',
};

function getLang(file) {
  const base = path.basename(file).toLowerCase();
  if (base === 'makefile' || base === 'gnumakefile') return 'makefile';
  if (base === 'dockerfile') return 'dockerfile';
  if (base === '.prettierrc' || base === '.eslintrc') return 'yaml';
  if (base === '.babelrc') return 'json';
  if (base === '.bashrc' || base === '.zshrc' || base === '.profile') return 'bash';
  if (base === 'bunfig.toml') return 'toml';

  const ext = path.extname(file).slice(1).toLowerCase();
  const lang = extToLang[ext];
  if (lang && hljs.getLanguage(lang)) return lang;
  return 'plaintext';
}

// ============================================================================
// File discovery
// ============================================================================

const skipDirs = new Set([
  '.git', 'node_modules', '.rip-cache', '.zig-cache', 'zig-out', 'dist', 'misc'
]);

const defaultExclude = new Set([
  'css', 'gif', 'ico', 'jpg', 'jpeg', 'png', 'svg', 'pdf', 'webp',
  'otf', 'ttf', 'eot', 'woff', 'woff2',
  'o', 'a', 'dylib', 'so', 'dll',
  'gem', 'gz', 'zip', 'tar', 'br',
  'lock', 'db', 'sqlite3', 'sqlite',
  'map', 'min.js', 'min.css',
  'vsix', 'DS_Store',
]);

function walkDir(dir, base) {
  if (!base) base = dir;
  const files = [];
  let entries;
  try { entries = fs.readdirSync(dir); } catch { return files; }
  for (const entry of entries) {
    const full = path.join(dir, entry);
    let stat;
    try { stat = fs.statSync(full); } catch { continue; }
    if (stat.isDirectory()) {
      if (entry.startsWith('.') || skipDirs.has(entry)) continue;
      files.push(...walkDir(full, base));
    } else if (stat.isFile()) {
      const ext = (entry.split('.').pop() || '').toLowerCase();
      if (defaultExclude.has(ext)) continue;
      if (entry.startsWith('.')) continue;
      files.push(path.relative(base, full) || full);
    }
  }
  files.sort();
  return files;
}

// ============================================================================
// Code highlighting
// ============================================================================

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function stripTopComments(code) {
  const lines = code.split('\n');
  let i = 0;
  while (i < lines.length && (lines[i].startsWith('#') || lines[i].trim() === '')) i++;
  if (i === 0) return code;
  return lines.slice(i).join('\n');
}

function highlightCode(code, lang) {
  let highlighted = null;
  try {
    if (lang !== 'plaintext') {
      highlighted = hljs.highlight(code, { language: lang }).value;
    }
  } catch { /* fall through */ }
  if (!highlighted) highlighted = escapeHtml(code);

  const lines = highlighted.split('\n');
  return lines.map((line, i) => {
    const num = String(i + 1).padStart(4);
    const cls = i === 0 ? 'line-num first' : 'line-num';
    return `<span class="${cls}">${num}</span>  ${line}`;
  }).join('\n');
}

// ============================================================================
// Theme loading
// ============================================================================

const themeList = [
  { id: 'github',              name: 'GitHub Light',     dark: false },
  { id: 'atom-one-light',      name: 'Atom One Light',   dark: false },
  { id: 'vs',                  name: 'Visual Studio',    dark: false },
  { id: 'xcode',               name: 'Xcode',            dark: false },
  { id: 'intellij-light',      name: 'IntelliJ Light',   dark: false },
  { id: 'stackoverflow-light', name: 'Stack Overflow',   dark: false },
  { id: 'default',             name: 'Default Light',    dark: false },
  { id: 'github-dark',         name: 'GitHub Dark',      dark: true },
  { id: 'atom-one-dark',       name: 'Atom One Dark',    dark: true },
  { id: 'monokai',             name: 'Monokai',          dark: true },
  { id: 'nord',                name: 'Nord',             dark: true },
  { id: 'vs2015',              name: 'VS 2015 Dark',     dark: true },
  { id: 'tokyo-night-dark',    name: 'Tokyo Night',      dark: true },
  { id: 'night-owl',           name: 'Night Owl',        dark: true },
];

function loadThemes() {
  const hljsRoot = path.dirname(require.resolve('highlight.js/package.json'));
  const stylesDir = path.join(hljsRoot, 'styles');
  const loaded = [];
  for (const theme of themeList) {
    try {
      const css = fs.readFileSync(path.join(stylesDir, `${theme.id}.css`), 'utf-8');
      loaded.push({ ...theme, encoded: Buffer.from(css).toString('base64') });
    } catch { /* skip missing themes */ }
  }
  return loaded;
}

// ============================================================================
// HTML generation
// ============================================================================

function formatTimestamp(date) {
  const d = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  const t = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase();
  return `${d} at ${t}`;
}

/**
 * Generate a complete HTML document for printing syntax-highlighted source code.
 *
 * @param {Array<{file: string, code: string, mtime?: Date}>} files - Files to print
 * @param {Object}  [options]
 * @param {boolean} [options.dark]    - Dark color scheme (default: false)
 * @param {boolean} [options.bypass]  - Strip leading comment blocks (default: false)
 * @returns {string} Complete HTML document
 */
function generatePrintHtml(files, options = {}) {
  const { dark = false, bypass = false } = options;

  // Highlight all files
  const sections = [];
  for (const { file, code: rawCode, mtime } of files) {
    let code = rawCode.replace(/\t/g, '  ').replace(/\r\n?/g, '\n');
    if (bypass) code = stripTopComments(code);
    const lang = getLang(file);
    const lineCount = code.split('\n').length;
    const timestamp = mtime ? formatTimestamp(mtime) : '';
    const highlighted = highlightCode(code, lang);
    sections.push({ file, lineCount, lang, timestamp, html: `<pre><code class="hljs">${highlighted}</code></pre>` });
  }

  // Color scheme
  const bg  = dark ? '#0d1117' : '#ffffff';
  const fg  = dark ? '#e6edf3' : '#1f2328';
  const hdr = dark ? '#161b22' : '#f6f8fa';
  const brd = dark ? '#30363d' : '#d0d7de';
  const gut = dark ? '#161b22' : '#f4f4f4';
  const act = dark ? '#30363d' : '#e0e0e0';

  // Table of contents
  let toc = '';
  if (sections.length > 1) {
    const items = sections.map(s =>
      `<li><a href="#${s.file}">${s.file}</a> <span class="meta">(${s.lineCount} lines)</span></li>`
    ).join('\n        ');
    toc = `
    <div class="toc">
      <h2>Files (${sections.length})</h2>
      <ol>
        ${items}
      </ol>
    </div>`;
  }

  // File sections with navigation
  const count = sections.length;
  const fileSections = sections.map((section, i) => {
    const prev = sections[(i - 1 + count) % count];
    const next = sections[(i + 1) % count];
    let nav = '';
    if (count > 1) nav += `<a href="#${prev.file}">prev</a> `;
    if (count > 1) nav += `<a href="#${next.file}">next</a> `;
    nav += '<a href="#top">&uarr; top</a>';
    return `
    <div class="file-section">
      <div class="file-header" id="${section.file}">
        <span>${section.file} <span class="meta">(${section.lineCount} lines) [${section.lang}]${section.timestamp ? ` on ${section.timestamp}` : ''}</span></span>
        <span class="nav">${nav}</span>
      </div>
      <div class="code-container">
        ${section.html}
      </div>
    </div>`;
  }).join('\n');

  // Load highlight.js themes
  const loadedThemes = loadThemes();
  const defaultTheme = dark ? 'github-dark' : 'github';
  const defaultData = loadedThemes.find(t => t.id === defaultTheme);
  const defaultCss = defaultData ? Buffer.from(defaultData.encoded, 'base64').toString('utf-8') : '';

  const themeEntries = loadedThemes.map(t =>
    `'${t.id}':{d:${t.dark},c:atob('${t.encoded}')}`
  ).join(',\n      ');

  const lightOpts = loadedThemes.filter(t => !t.dark).map(t =>
    `<option value="${t.id}"${t.id === defaultTheme ? ' selected' : ''}>${t.name}</option>`
  ).join('');

  const darkOpts = loadedThemes.filter(t => t.dark).map(t =>
    `<option value="${t.id}"${t.id === defaultTheme ? ' selected' : ''}>${t.name}</option>`
  ).join('');

  const now = new Date();
  const title = 'Rip Print \u2014 '
    + now.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    + ' at '
    + now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <link rel="icon" href="data:,">
  <style id="hljs-theme">${defaultCss}</style>
  <style>
    :root { --bg: ${bg}; --fg: ${fg}; --hdr: ${hdr}; --brd: ${brd}; --gut: ${gut}; --act: ${act}; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: var(--bg); color: var(--fg); }

    .toolbar { display: flex; align-items: center; padding: 8px 16px; border-bottom: 1px solid var(--brd); font-size: 13px; }
    .toolbar select { font-size: 13px; padding: 4px 8px; border-radius: 3px; border: 1px solid var(--brd); background: var(--bg); color: var(--fg); }
    .toolbar label { color: #888; margin-left: 16px; }
    .toolbar-spacer { flex: 1; }
    .print-btn { font-size: 13px; padding: 5px 14px; border-radius: 3px; border: 1px solid #007ACB; background: #007ACB; color: #fff; cursor: pointer; font-weight: 500; }
    .print-btn:hover { background: #006bb3; border-color: #006bb3; }

    .size-group { display: inline-flex; vertical-align: middle; margin-left: 4px; }
    .size-btn { font-size: 13px; width: 32px; height: 28px; border: 1px solid var(--brd); background: var(--bg); color: #888; cursor: pointer; margin: 0; padding: 0; }
    .size-btn:first-child { border-radius: 3px 0 0 3px; }
    .size-btn:last-child { border-radius: 0 3px 3px 0; }
    .size-btn + .size-btn { margin-left: -1px; }
    .size-btn.active { background: var(--act); color: var(--fg); font-weight: 600; }

    .toc { padding: 20px 30px; border-bottom: 1px solid var(--brd); }
    .toc h2 { font-size: 18px; margin-bottom: 10px; }
    .toc ol { padding-left: 24px; columns: 2; column-gap: 40px; }
    .toc li { font-size: 13px; line-height: 1.8; }
    .toc a { color: var(--fg); text-decoration: none; }
    .toc a:hover { text-decoration: underline; }
    .meta { color: #888; font-size: 12px; }

    .file-section { margin-bottom: 0; margin-top: -1px; }
    .file-header {
      background: var(--hdr); padding: 10px 16px 10px 5.85em; font-size: 13px; font-weight: 600;
      border-top: 1px solid var(--brd); border-bottom: 1px solid var(--brd);
      display: flex; justify-content: space-between; align-items: center;
    }
    .nav { font-weight: normal; font-size: 12px; }
    .nav a { color: #888; text-decoration: none; padding: 6px 10px; border-radius: 3px; }
    .nav a:hover { color: var(--fg); background: var(--act); }

    .code-container { overflow-x: auto; border-bottom: 1px solid var(--brd); }
    .code-container pre { margin: 0; border-radius: 0; }
    .code-container code { font-size: var(--code-size, 13px); line-height: 1.5; padding: 0 !important; display: block; }
    .line-num { color: #aaa; background: var(--gut); user-select: none; display: inline-block; min-width: 2em; text-align: right; padding: 0 0.7em; margin-right: 0.7em; border-right: 1px solid var(--brd); }
    .line-num.first { padding-top: 4px; }

    @media print {
      .file-header { background: #333 !important; color: #fff !important; box-shadow: inset 0 0 0 1000px #333; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .file-header .meta { color: #ccc !important; }
      .toolbar { display: none; }
      .nav { display: none; }
      body { background: white !important; color: black !important; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <button class="print-btn" id="print-btn">Print</button>
    <span class="toolbar-spacer"></span>
    <label>Size: <span class="size-group">
      <button class="size-btn" data-size="11">S</button>
      <button class="size-btn active" data-size="13">M</button>
      <button class="size-btn" data-size="15">L</button>
    </span></label>
    <label>Theme: <select id="theme-picker">
      <optgroup label="Light">${lightOpts}</optgroup>
      <optgroup label="Dark">${darkOpts}</optgroup>
    </select></label>
  </div>
  <a name="top"></a>${toc}
${fileSections}
  <script>
    var themes = {
      ${themeEntries}
    };

    document.getElementById('print-btn').addEventListener('click', function() {
      window.print();
    });

    document.getElementById('theme-picker').addEventListener('change', function(e) {
      var id = e.target.value;
      var t = themes[id];
      if (!t) return;
      document.getElementById('hljs-theme').textContent = t.c;
      var d = t.d;
      var r = document.documentElement.style;
      r.setProperty('--bg',  d ? '#0d1117' : '#ffffff');
      r.setProperty('--fg',  d ? '#e6edf3' : '#1f2328');
      r.setProperty('--hdr', d ? '#161b22' : '#f6f8fa');
      r.setProperty('--brd', d ? '#30363d' : '#d0d7de');
      r.setProperty('--gut', d ? '#161b22' : '#f4f4f4');
      r.setProperty('--act', d ? '#30363d' : '#e0e0e0');
      try { localStorage.setItem('rip-print-theme', id); } catch(x) {}
    });

    document.querySelectorAll('.size-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var size = btn.getAttribute('data-size') + 'px';
        document.documentElement.style.setProperty('--code-size', size);
        document.querySelectorAll('.size-btn').forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        try { localStorage.setItem('rip-print-size', btn.getAttribute('data-size')); } catch(x) {}
      });
    });

    try {
      var saved = localStorage.getItem('rip-print-theme');
      if (saved && themes[saved]) {
        document.getElementById('theme-picker').value = saved;
        document.getElementById('theme-picker').dispatchEvent(new Event('change'));
      }
      var savedSize = localStorage.getItem('rip-print-size');
      if (savedSize) {
        var sizeBtn = document.querySelector('.size-btn[data-size="' + savedSize + '"]');
        if (sizeBtn) sizeBtn.click();
      }
    } catch(x) {}
  </script>
</body>
</html>`;
}

module.exports = { generatePrintHtml, walkDir, getLang, defaultExclude, skipDirs };
