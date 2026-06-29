// Ambient type for the global `ARIA` accessibility helpers (globalThis.ARIA).
//
// This is the consumer-facing contract for the `ARIA` helpers implemented in
// index.rip (`AriaApi` + `_aria`). A project opts a `.rip` file into this typing
// by adding the file to `package.json#rip.types`, e.g.
//
//   { "rip": { "types": ["node_modules/@rip-lang/app/aria.d.ts"] } }
//
// `rip check` then loads it as an explicit program root so its global `declare`s
// are visible to every `.rip` file in the project. (Before, `rip check` always
// auto-injected this contract into any file that referenced `ARIA.`; it now ships
// here and is opt-in — see the discoverability note in packages/app/AGENTS.md.)
//
// This MUST stay in sync with `AriaApi` in index.rip (the implementation
// contract). The pairing is guarded by test/check.test.js — update both sides
// together. Helper types are `__Rip`-prefixed so they never collide with
// consumer-defined names.

type __RipAriaEl = HTMLElement | null | undefined;
type __RipAriaElRef = __RipAriaEl | (() => __RipAriaEl);
type __RipAriaDisposer = () => void;
type __RipAriaNavHandlers = { next?: () => void; prev?: () => void; first?: () => void; last?: () => void; select?: () => void; dismiss?: () => void; tab?: () => void; char?: (key: string) => void; };
type __RipAriaPositionOptions = { placement?: string; offset?: number; matchWidth?: boolean; };
type __RipAriaPopupGuard = { block: (ms?: number) => void; canOpen: () => boolean; };
declare const ARIA: {
  listNav(e: KeyboardEvent, h: __RipAriaNavHandlers): void;
  rovingNav(e: KeyboardEvent, h: __RipAriaNavHandlers, orientation?: 'vertical' | 'horizontal' | 'both'): void;
  popupDismiss(open: boolean, popup: __RipAriaElRef, close: () => void, els?: __RipAriaElRef[], repos?: (() => void) | null): __RipAriaDisposer | undefined;
  popupGuard(delay?: number): __RipAriaPopupGuard;
  bindPopover(open: boolean, popover: __RipAriaElRef, setOpen: (open: boolean) => void, source?: __RipAriaElRef): __RipAriaDisposer | undefined;
  bindDialog(open: boolean, dialog: __RipAriaElRef, setOpen: (open: boolean) => void, dismissable?: boolean): __RipAriaDisposer | undefined;
  positionBelow(trigger: __RipAriaEl, popup: __RipAriaEl, gap?: number, setVisible?: boolean): void;
  trapFocus(panel: Element): __RipAriaDisposer;
  wireAria(panel: __RipAriaEl, id: string): void;
  lockScroll(instance: unknown): void;
  unlockScroll(instance: unknown): void;
  position(trigger: __RipAriaEl, floating: __RipAriaEl, opts?: __RipAriaPositionOptions): void;
  hasAnchor(): boolean;
  combine(...disposers: Array<__RipAriaDisposer | null | undefined>): __RipAriaDisposer;
};
