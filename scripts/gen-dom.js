#!/usr/bin/env bun
// Generate DOM metadata from TypeScript's lib.dom.d.ts.

import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ts from 'typescript';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const generatedDir = path.join(rootDir, 'src', 'generated');
const eventsOutputPath = path.join(generatedDir, 'dom-events.js');
const tagsOutputPath = path.join(generatedDir, 'dom-tags.js');

// Keep a tiny explicit compatibility list for tags Rip already recognizes
// but which are missing or separated differently in TypeScript's current DOM maps.
const HTML_COMPAT_EXTRA_TAGS = ['math', 'param', 'portal'];

function getDomLibPath() {
  const libDir = path.dirname(ts.getDefaultLibFilePath({ target: ts.ScriptTarget.ES2022 }));
  return path.join(libDir, 'lib.dom.d.ts');
}

function createDomProgram(domLibPath) {
  const program = ts.createProgram([domLibPath], {
    noEmit: true,
    target: ts.ScriptTarget.ES2022,
  });
  const sourceFile = program.getSourceFile(domLibPath);
  if (!sourceFile) throw new Error(`Could not load ${domLibPath}`);
  return { program, sourceFile, checker: program.getTypeChecker() };
}

function getInterfacePropertyNames(checker, sourceFile, interfaceName) {
  let targetNode = null;
  const visit = (node) => {
    if (ts.isInterfaceDeclaration(node) && node.name.text === interfaceName) {
      targetNode = node;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  if (!targetNode) throw new Error(`Could not find interface ${interfaceName} in lib.dom.d.ts`);
  const symbol = checker.getSymbolAtLocation(targetNode.name);
  if (!symbol) throw new Error(`Could not resolve ${interfaceName}`);
  return checker.getPropertiesOfType(checker.getDeclaredTypeOfSymbol(symbol)).map(sym => sym.getName()).sort();
}

function formatArray(name, values) {
  return `export const ${name} = [\n${values.map(v => `  '${v}',`).join('\n')}\n];\n`;
}

function buildEventsOutput(events, domLibPath) {
  const names = events.map(name => `  '${name}',`).join('\n');
  return `// Generated from TypeScript's lib.dom.d.ts
// Source: ${domLibPath}
// Run: bun scripts/gen-dom.js

export const DOM_EVENT_NAMES = [
${names}
];

export const DOM_EVENTS = new Set(DOM_EVENT_NAMES);
`;
}

function buildTagsOutput(domLibPath, htmlTags, svgTags, mathmlTags, svgOnlyTags, compatHtmlTags) {
  return `// Generated from TypeScript's lib.dom.d.ts
// Source: ${domLibPath}
// Run: bun scripts/gen-dom.js

${formatArray('HTML_TAG_NAMES', htmlTags)}
${formatArray('SVG_TAG_NAMES', svgTags)}
${formatArray('MATHML_TAG_NAMES', mathmlTags)}
${formatArray('SVG_NAMESPACE_TAG_NAMES', svgOnlyTags)}
${formatArray('HTML_COMPAT_EXTRA_TAG_NAMES', compatHtmlTags)}

export const HTML_TAGS = new Set([...HTML_TAG_NAMES, ...HTML_COMPAT_EXTRA_TAG_NAMES]);
export const SVG_TAGS = new Set(SVG_NAMESPACE_TAG_NAMES);
export const TEMPLATE_TAGS = new Set([...HTML_TAGS, ...SVG_TAGS]);
`;
}

function main() {
  const domLibPath = getDomLibPath();
  const { sourceFile, checker } = createDomProgram(domLibPath);

  const events = getInterfacePropertyNames(checker, sourceFile, 'HTMLElementEventMap');
  const htmlTags = getInterfacePropertyNames(checker, sourceFile, 'HTMLElementTagNameMap');
  const svgTags = getInterfacePropertyNames(checker, sourceFile, 'SVGElementTagNameMap');
  const mathmlTags = getInterfacePropertyNames(checker, sourceFile, 'MathMLElementTagNameMap');
  const htmlTagSet = new Set(htmlTags);
  const svgOnlyTags = svgTags.filter(tag => !htmlTagSet.has(tag));

  mkdirSync(generatedDir, { recursive: true });
  writeFileSync(eventsOutputPath, buildEventsOutput(events, domLibPath));
  writeFileSync(tagsOutputPath, buildTagsOutput(domLibPath, htmlTags, svgTags, mathmlTags, svgOnlyTags, HTML_COMPAT_EXTRA_TAGS));

  console.log(`Generated ${events.length} DOM events -> ${path.relative(rootDir, eventsOutputPath)}`);
  console.log(`Generated HTML (${htmlTags.length}), SVG (${svgTags.length}), SVG namespace-only (${svgOnlyTags.length}) tags -> ${path.relative(rootDir, tagsOutputPath)}`);
}

main();
