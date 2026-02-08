// ============================================================================
// Shared HTML/SVG Tag Definitions
// ============================================================================
// Single source of truth for tag recognition in templates.
// Used by lexer and codegen at compile time.

export const HTML_TAGS = new Set([
  // Document metadata
  'html', 'head', 'title', 'base', 'link', 'meta', 'style',
  // Sectioning
  'body', 'address', 'article', 'aside', 'footer', 'header',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'main', 'nav', 'section',
  // Grouping
  'blockquote', 'dd', 'div', 'dl', 'dt', 'figcaption', 'figure',
  'hr', 'li', 'ol', 'p', 'pre', 'ul',
  // Text-level
  'a', 'abbr', 'b', 'bdi', 'bdo', 'br', 'cite', 'code', 'data',
  'dfn', 'em', 'i', 'kbd', 'mark', 'q', 'rp', 'rt', 'ruby', 's',
  'samp', 'small', 'span', 'strong', 'sub', 'sup', 'time', 'u', 'var', 'wbr',
  // Embedded
  'area', 'audio', 'img', 'map', 'track', 'video',
  'embed', 'iframe', 'object', 'param', 'picture', 'portal', 'source',
  // SVG/Math
  'svg', 'math', 'canvas',
  // Scripting
  'noscript', 'script',
  // Edits
  'del', 'ins',
  // Tables
  'caption', 'col', 'colgroup', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr',
  // Forms
  'button', 'datalist', 'fieldset', 'form', 'input', 'label', 'legend',
  'meter', 'optgroup', 'option', 'output', 'progress', 'select', 'textarea',
  // Interactive
  'details', 'dialog', 'menu', 'summary',
  // Web components
  'slot', 'template'
]);

export const SVG_TAGS = new Set([
  // Container elements
  'svg', 'g', 'defs', 'symbol', 'use', 'marker', 'clipPath', 'mask', 'pattern',
  // Shape elements
  'circle', 'ellipse', 'line', 'path', 'polygon', 'polyline', 'rect',
  // Text elements
  'text', 'textPath', 'tspan',
  // Gradient elements
  'linearGradient', 'radialGradient', 'stop',
  // Filter elements
  'filter', 'feBlend', 'feColorMatrix', 'feComponentTransfer', 'feComposite',
  'feConvolveMatrix', 'feDiffuseLighting', 'feDisplacementMap', 'feDistantLight',
  'feDropShadow', 'feFlood', 'feFuncA', 'feFuncB', 'feFuncG', 'feFuncR',
  'feGaussianBlur', 'feImage', 'feMerge', 'feMergeNode', 'feMorphology',
  'feOffset', 'fePointLight', 'feSpecularLighting', 'feSpotLight', 'feTile', 'feTurbulence',
  // Animation elements
  'animate', 'animateMotion', 'animateTransform', 'set', 'mpath',
  // Other elements
  'desc', 'foreignObject', 'image', 'metadata', 'switch', 'title', 'view'
]);

// Combined set for template element detection (HTML + common SVG)
export const TEMPLATE_TAGS = new Set([...HTML_TAGS, ...SVG_TAGS]);
