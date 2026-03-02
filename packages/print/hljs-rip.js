// highlight.js language definition for Rip
// https://github.com/nicholasgasior/ghljs

export default function(hljs) {
  const KEYWORDS = [
    // Control flow
    'if', 'else', 'unless', 'then', 'switch', 'when',
    'for', 'while', 'until', 'loop', 'do',
    'return', 'break', 'continue', 'throw',
    'try', 'catch', 'finally',
    'yield', 'await',
    // Modules
    'import', 'export', 'from', 'default',
    // Operators as keywords
    'delete', 'typeof', 'instanceof', 'new', 'super',
    'and', 'or', 'not', 'is', 'isnt',
    // Declarations
    'class', 'def', 'enum', 'interface', 'extends', 'own',
    // Iteration
    'in', 'of', 'by', 'as',
    // Component system
    'component', 'render', 'slot', 'offer', 'accept',
    // Other
    'use', 'debugger', 'it',
  ];

  const LITERALS = [
    'true', 'false', 'yes', 'no', 'on', 'off',
    'null', 'undefined', 'NaN', 'Infinity', 'this',
  ];

  const BUILT_INS = [
    'console', 'process', 'require', 'module', 'exports',
    'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval',
    'requestAnimationFrame', 'cancelAnimationFrame',
    'Promise', 'Array', 'Object', 'String', 'Number', 'Boolean',
    'Math', 'Date', 'RegExp', 'Error', 'TypeError', 'RangeError',
    'JSON', 'Map', 'Set', 'WeakMap', 'WeakSet',
    'Symbol', 'Proxy', 'Reflect',
    'Buffer', 'Bun',
    'document', 'window', 'globalThis', 'navigator',
    'fetch', 'URL', 'URLSearchParams', 'FormData',
    'Event', 'CustomEvent', 'EventSource',
    'HTMLElement', 'Node', 'NodeList', 'Element',
    'DocumentFragment', 'MutationObserver', 'ResizeObserver',
    'IntersectionObserver',
    // Rip stdlib
    'p', 'pp', 'abort', 'assert', 'exit', 'kind', 'noop',
    'raise', 'rand', 'sleep', 'todo', 'warn', 'zip',
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

  const SIGIL_ATTR = {
    className: 'attribute',
    begin: /\$[a-zA-Z_][\w]*/,
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

  const METHOD_DEF = {
    className: 'function',
    begin: /[a-zA-Z_$][\w$]*[!?]?\s*:/,
    end: /[-=]>/,
    excludeEnd: true,
    contains: [
      { className: 'title.function', begin: /[a-zA-Z_$][\w$]*[!?]?/, end: /:/, excludeEnd: true },
    ],
  };

  const COMPONENT_DEF = {
    className: 'class',
    begin: /\b(?:export\s+)?[A-Z][\w]*\s*=\s*component\b/,
    returnBegin: true,
    keywords: { keyword: ['export', 'component'] },
    contains: [
      { className: 'title.class', begin: /[A-Z][\w]*/ },
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
    begin: /\|>|::=|::|:=|~=|~>|<=>|\.=|=!|!\?|\?!|=~|\?\?=|\?\?|\?\.|\.\.\.|\.\.|=>|->|\*\*|\/\/|%%|===|!==|==|!=|<=|>=|&&|\|\||[+\-*\/%&|^~<>=!?]/,
    relevance: 0,
  };

  const TYPE_ANNOTATION = {
    className: 'type',
    begin: /::=?\s*/,
    end: /$/,
    excludeBegin: true,
    contains: [
      { className: 'type', begin: /\b(?:number|string|boolean|void|any|never|unknown|object|symbol|bigint)\b/ },
      { className: 'title.class', begin: /[A-Z][\w]*/ },
    ],
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
      COMPONENT_DEF,
      FUNCTION_DEF,
      METHOD_DEF,
      CLASS_DEF,
      NUMBER,
      INSTANCE_VAR,
      SIGIL_ATTR,
      TYPE_KEYWORDS,
      OPERATORS,
      { // inline JS (backtick)
        className: 'string',
        begin: /`[^`]*`/,
      },
    ],
  };
}
