// Shared parameter-rendering policy for Rip's typed surfaces.
//
// Two emitters turn a function parameter into a TypeScript param string: the
// check-path inline emitter (`formatParam` in compiler.js, walking AST nodes)
// and the .d.ts emitter (`collectParams` in dts.js, walking lexer tokens).
// They read different inputs, but the rule for mapping a param's
// {name, type, optional, default} onto TS is a single policy. When that policy
// lived in both places it drifted: an untyped optional param like
// `(dob, asOf?) ->` dropped its `?` and was treated as required in each, and
// the fix had to be applied to both independently. This module owns the rule
// so the two surfaces cannot diverge again. See RFC 12 (Unified emitter),
// phase 0 — the full retirement of the token-walking second parser is the
// unified-emitter end state (phase 2); this is the safe interim de-duplication.

// Rip type strings carry `::` (the type-annotation operator); TypeScript wants
// a single `:`. This is the one type-string conversion both surfaces share.
export function ripToTs(typeStr) {
  if (!typeStr) return typeStr;
  return typeStr.replace(/::/g, ':');
}

// Render one normalized parameter into a TypeScript param string.
//
//   field = { name, ripType, optional, hasDefault }
//   mode  = 'declaration'    — the .d.ts surface
//           'implementation' — the inline check-path surface
//
// Optionality differs by surface. In a .d.ts a defaulted param is written
// optional (`name?: T`): the declaration carries no initializer, so the `?` is
// what tells callers the argument may be omitted. On the implementation/check
// path the initializer is present (`name: T = expr`), which already makes the
// param optional, and TypeScript rejects `?` alongside an initializer — so a
// default must NOT add `?` there. An explicit `name?` is optional on both
// surfaces. An untyped optional falls back to `?: any`.
export function emitTsParam({ name, ripType, optional, hasDefault }, mode) {
  let isOptional = optional || (mode === 'declaration' && hasDefault);
  let type = ripToTs(ripType);
  if (type) return `${name}${isOptional ? '?' : ''}: ${type}`;
  if (isOptional) return `${name}?: any`;
  return name;
}
