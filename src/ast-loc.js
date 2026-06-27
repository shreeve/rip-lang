// AST location helpers — RFC 12 (Unified emitter), phase 1.
//
// sexpr array nodes carry two location facts:
//   - `node.loc`     = { r, c, n } — this node's own span (set in the parser).
//   - `node.subLocs` = per-element source locs, index-aligned to the node's
//                      elements (element 0 is the head/tag, usually null).
//                      Non-enumerable; attached by the generated parser's
//                      `__sub` for array-template reductions.
//
// Primitive leaves (bare identifiers, strings, numbers) can't carry their own
// `.loc`, so a leaf's exact source position lives on its parent as
// `parent.subLocs[index]`. `childLoc` reads that uniformly, falling back to a
// child's own `.loc` (array children have one) when no `subLocs` entry is
// present (nested-array templates, not yet covered by the parser).

export const SUB_LOCS = 'subLocs';

// This node's own span, or null.
export function nodeLoc(node) {
  return node && typeof node === 'object' ? (node.loc ?? null) : null;
}

// The source loc of `parent`'s child at `index` — from the parent's per-element
// `subLocs` when present, else the child's own `.loc` (arrays), else null.
export function childLoc(parent, index) {
  if (!Array.isArray(parent)) return null;
  const subs = parent[SUB_LOCS];
  if (subs && subs[index] != null) return subs[index];
  return nodeLoc(parent[index]);
}
