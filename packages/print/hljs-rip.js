// highlight.js language definition for Rip
// Derived from the Monarch grammar in docs/index.html

export default function(hljs) {
  const KEYWORDS = [
    'if', 'else', 'unless', 'then', 'switch', 'when', 'for', 'while', 'until',
    'loop', 'do', 'return', 'break', 'continue', 'throw', 'try', 'catch', 'finally',
    'yield', 'await', 'import', 'export', 'from', 'default', 'delete', 'typeof',
    'instanceof', 'new', 'super', 'debugger', 'use', 'own', 'extends', 'in', 'of',
    'by', 'as', 'class', 'def', 'enum', 'interface', 'component', 'render',
    'and', 'or', 'not', 'is', 'isnt',
  ];

  const LITERALS = [
    'true', 'false', 'yes', 'no', 'on', 'off',
    'null', 'undefined', 'NaN', 'Infinity',
  ];

  const BUILT_INS = [
    'console', 'process', 'require', 'module', 'exports',
    'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval',
    'Promise', 'Array', 'Object', 'String', 'Number', 'Boolean',
    'Math', 'Date', 'RegExp', 'Error', 'JSON', 'Map', 'Set',
    'Symbol', 'Buffer', 'Bun',
  ];

  const INTERPOLATION = {
    className: 'subst',
    begin: /#\{/, end: /\}/,
    keywords: { keyword: KEYWORDS, literal: LITERALS },
  };

  const STRING_DOUBLE = {
    className: 'string',
    begin: '"', end: '"',
    contains: [hljs.BACKSLASH_ESCAPE, INTERPOLATION],
  };

  const STRING_SINGLE = {
    className: 'string',
    begin: "'", end: "'",
    contains: [hljs.BACKSLASH_ESCAPE],
  };

  const HEREDOC_DOUBLE = {
    className: 'string',
    begin: '"""', end: '"""',
    contains: [hljs.BACKSLASH_ESCAPE, INTERPOLATION],
  };

  const HEREDOC_SINGLE = {
    className: 'string',
    begin: "'''", end: "'''",
    contains: [hljs.BACKSLASH_ESCAPE],
  };

  const HEREGEX = {
    className: 'regexp',
    begin: '///', end: '///[gimsuy]*',
    contains: [INTERPOLATION, hljs.HASH_COMMENT_MODE],
  };

  const REGEX = {
    className: 'regexp',
    begin: /\/(?![/*])(?:[^\/\\]|\\.)*\/[gimsuy]*/,
    relevance: 0,
  };

  const BLOCK_COMMENT = {
    className: 'comment',
    begin: '###', end: '###',
    contains: [hljs.PHRASAL_WORDS_MODE],
  };

  const LINE_COMMENT = hljs.COMMENT('#', '$');

  const NUMBER = {
    className: 'number',
    variants: [
      { begin: /0x[0-9a-fA-F](?:_?[0-9a-fA-F])*n?/ },
      { begin: /0o[0-7](?:_?[0-7])*n?/ },
      { begin: /0b[01](?:_?[01])*n?/ },
      { begin: /\d[\d_]*(?:\.[\d][\d_]*)?(?:[eE][+-]?\d+)?n?/ },
    ],
    relevance: 0,
  };

  const INSTANCE_VAR = {
    className: 'variable',
    begin: /@[a-zA-Z_$][\w$]*/,
  };

  const CLASS_NAME = {
    className: 'title.class',
    begin: /[A-Z][\w]*/,
  };

  const FUNCTION_DEF = {
    className: 'function',
    begin: /\bdef\s+/,
    end: /[(\s]/,
    excludeEnd: true,
    keywords: { keyword: 'def' },
    contains: [
      { className: 'title.function', begin: /[a-zA-Z_$][\w$]*[!?]?/ },
    ],
  };

  const CLASS_DEF = {
    className: 'class',
    beginKeywords: 'class',
    end: /$/,
    contains: [
      { className: 'title.class', begin: /[A-Z][\w]*/ },
      { beginKeywords: 'extends', contains: [CLASS_NAME] },
    ],
  };

  const OPERATORS = {
    className: 'operator',
    begin: /\|>|::=|::|:=|~=|~>|<=>|=!|!\?|=~|\?\?|\?\.|\.\.\.|\.\.|=>|->|\*\*|\/\/|%%|===|!==|==|!=|<=|>=|&&|\|\||[+\-*\/%&|^~<>=!?]/,
    relevance: 0,
  };

  const TYPE_KEYWORDS = {
    className: 'type',
    begin: /\b(?:number|string|boolean|void|any|never|unknown|object|symbol|bigint)\b/,
  };

  return {
    name: 'Rip',
    aliases: ['rip'],
    keywords: {
      keyword: KEYWORDS,
      literal: LITERALS,
      built_in: BUILT_INS,
    },
    contains: [
      BLOCK_COMMENT,
      LINE_COMMENT,
      HEREDOC_DOUBLE,
      HEREDOC_SINGLE,
      STRING_DOUBLE,
      STRING_SINGLE,
      HEREGEX,
      REGEX,
      FUNCTION_DEF,
      CLASS_DEF,
      NUMBER,
      INSTANCE_VAR,
      TYPE_KEYWORDS,
      OPERATORS,
      { // inline JS
        className: 'string',
        begin: /`[^`]*`/,
      },
    ],
  };
}
