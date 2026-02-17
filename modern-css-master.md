# Modern CSS Reference

> Every old CSS hack next to its clean, modern replacement.

Source: modern-css.com


---

## Table of Contents

1. [Comparisons](#comparisons) (old way vs modern way)
2. [Articles](#articles) (step-by-step tutorials)
3. [What's New in CSS](#whats-new-in-css) (features by year)
4. [Resources](#resources) (curated links)


---

## Comparisons


---

### Category: Layout

### Aligning nested grids without duplicating tracks

*Layout · Advanced*

Inner grids used to repeat the parent's column definitions to align. That was fragile and got out of sync. Subgrid inherits the parent's tracks so everything lines up.


**Modern approach:**

```css
.child-grid {
  display: grid;
  grid-template-columns: subgrid;
}
```

**Old approach:**

```css
.parent {
 display: grid;
 grid-template-columns: 1fr 1fr 1fr;
}

.child-grid {
 display: grid;
 grid-template-columns: 1fr 1fr 1fr;
}
/* Breaks when parent columns change */
```


**Browser support:** Newly available · Since 2023 · 88% global usage

Browsers: Chrome 117+, Firefox 71+, Safari 16+, Edge 117+

[View on caniuse.com →](https://caniuse.com/css-subgrid) · [View on MDN →](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_grid_layout/Subgrid) · [View on webstatus.dev →](https://webstatus.dev/features/subgrid) · [Learn more about Baseline →](https://web.dev/blog/announcing-baseline-in-action)


**Why the modern way wins:**

- **Single source of truth** -- Column tracks are defined once on the parent. Change the parent, nested content aligns automatically.
- **No duplication** -- No copying 1fr 1fr 1fr or repeat() into every nested grid. Less code, fewer mismatches.
- **Real alignment** -- Cards, lists, or forms that span the same columns actually line up across sections.


**At a glance:**

- **Lines Saved:** 8 → 5 (No repeated track defs)
- **Old Approach:** Duplicate tracks (Fragile, goes out of sync)
- **Modern Approach:** subgrid (Inherits parent columns)


**How it works:**

The old way was to give the inner grid the same `grid-template-columns` as the parent so things visually lined up. Any time you changed the parent's columns, you had to find and update every nested grid. Easy to miss one and end up with misaligned content.

With `grid-template-columns: subgrid`, the child grid does not define its own columns. It reuses the parent's track list. Add or change columns on the parent once, and every subgrid lines up. You can also use `grid-template-rows: subgrid` for row alignment.


### Aspect ratios without the padding hack

*Layout · Beginner*

The old trick used padding-top: 56.25% and nested absolute positioning. aspect-ratio does it in one declaration.


**Modern approach:**

```css
.video-wrapper {
  aspect-ratio: 16 / 9;
}
```

**Old approach:**

```css
.video-wrapper {
 position: relative;
 padding-top: 56.25%;
}

.video-wrapper > * {
 position: absolute;
 top: 0; left: 0;
 width: 100%; height: 100%;
}
```


**Browser support:** Widely available · Since 2021 · 93% global usage

Browsers: Chrome 88+, Firefox 89+, Safari 15+, Edge 88+

[View on caniuse.com →](https://caniuse.com/mdn-css_properties_aspect-ratio) · [View on MDN →](https://developer.mozilla.org/en-US/docs/Web/CSS/aspect-ratio) · [View on webstatus.dev →](https://webstatus.dev/features/aspect-ratio) · [Learn more about Baseline →](https://web.dev/blog/announcing-baseline-in-action)


**Why the modern way wins:**

- **No math** -- 16/9, 4/3, 1/1. No percentage math or nested wrappers.
- **Single element** -- One container, one property. Content can sit inside without absolute positioning.
- **Any ratio** -- Use any ratio you need. Works with flex and grid too.


**At a glance:**

- **Lines Saved:** 8 → 2 (75% less code)
- **Old Approach:** Padding + absolute (56.25% for 16:9)
- **Modern Approach:** One property (aspect-ratio: 16/9)


**How it works:**

The classic trick was a wrapper with `padding-top: 56.25%` (100/16*9 for 16:9) and `position: relative`, then a child with `position: absolute; inset: 0` to fill it. Two selectors, magic numbers, and the child had to be taken out of flow.

`aspect-ratio: 16 / 9` on the container does the job. The element keeps that ratio as width changes. No padding hack, no absolute child, no percentage math.


### Auto-growing textarea without JavaScript

*Layout · Beginner*

Making a textarea grow as the user types required a JS event listener that reset height to auto then set it to scrollHeight on every keystroke. field-sizing: content makes the field size itself to its content.


**Modern approach:**

```css
textarea {
  field-sizing: content;
  min-height: 3lh;
}
```

**Old approach:**

```css
textarea { overflow: hidden; }
// JS: reset height then set to scrollHeight on every input
el.addEventListener('input', () => {
 el.style.height = 'auto';
 el.style.height = el.scrollHeight + 'px';
});
```


**Browser support:** Newly available · Since 2024 · 73% global usage

Browsers: Chrome 123+, Firefox 130+, Safari 18.2+, Edge 123+

[View on caniuse.com →](https://caniuse.com/mdn-css_properties_field-sizing) · [View on MDN →](https://developer.mozilla.org/en-US/docs/Web/CSS/field-sizing) · [View on webstatus.dev →](https://webstatus.dev/features/field-sizing) · [Learn more about Baseline →](https://web.dev/blog/announcing-baseline-in-action)


**Why the modern way wins:**

- **Zero JavaScript** -- No oninput listener, no scrollHeight, no height reset trick. The browser handles the resize.
- **Works on inputs too** -- field-sizing: content works on single-line text inputs as well. The input grows with the typed value.
- **Min and max still work** -- Set min-height for the default empty size and max-height to cap growth. CSS handles the range.


**At a glance:**

- **Lines Saved:** 7 → 4 (No JS resize handler)
- **Old Approach:** scrollHeight + JS (Reset and re-measure on every input)
- **Modern Approach:** field-sizing: content (Native auto-resize in CSS)


**How it works:**

Auto-growing textareas required JavaScript on every keystroke: first set height to auto so the element could shrink, then immediately set height to scrollHeight to match the content. One listener per textarea, causing a forced reflow on every keypress.

`field-sizing: content` tells the browser to size the field to fit its content instead of a fixed box. Use `min-height` to set the default empty state and `max-height` to cap how tall it can grow. No JavaScript, no event listeners, no scrollHeight.


### Carousel navigation without a JavaScript library

*Layout · Advanced*

Carousels used to need libraries like Swiper.js or Slick for navigation buttons and dot indicators. CSS scroll-button and scroll-marker pseudo-elements give you native, accessible carousel UI.


**Modern approach:**

```css
.carousel::scroll-button(left) {
  content: "⬅" / "Scroll left";
}
.carousel::scroll-button(right) {
  content: "➡" / "Scroll right";
}
.carousel { scroll-marker-group: after; }
.carousel li::scroll-marker {
  content: '';
  width: 10px; height: 10px;
  border-radius: 50%;
}
```

**Old approach:**

```css
/* JS: Swiper.js carousel with nav + dots */
import Swiper from 'swiper';
new Swiper('.carousel', {
 navigation: {
   nextEl: '.next',
   prevEl: '.prev',
 },
 pagination: { el: '.dots' },
});
/* + custom CSS for buttons, dots, states */
```


**Browser support:** Limited availability · 72% global usage

Browsers: Chrome 135+, Edge 135+

[View on caniuse.com →](https://caniuse.com/css-scroll-markers) · [View on webstatus.dev →](https://webstatus.dev/features/scroll-markers) · [Learn more about Baseline →](https://web.dev/blog/announcing-baseline-in-action)


**Why the modern way wins:**

- **Native performance** -- Scroll buttons and markers are browser-generated pseudo-elements. No JS, no DOM manipulation, no resize observers.
- **Accessible by default** -- Buttons are focusable and auto-disable at scroll ends. Markers work as anchor links. Keyboard and screen reader friendly.
- **Drop the library** -- Swiper.js is ~40 KB. The CSS approach is zero bytes of JavaScript and fully stylable.


**At a glance:**

- **Lines Saved:** 15+ → 14 (Zero JS, native a11y)
- **Old Approach:** JS carousel lib (Swiper.js, Slick, Flickity)
- **Modern Approach:** CSS pseudo-elements (::scroll-button, ::scroll-marker)


**How it works:**

Building a carousel traditionally meant a JavaScript library: Swiper.js, Slick, or Flickity. These libraries create navigation buttons, dot indicators, handle scroll snap, and manage active states. That's a lot of JavaScript and custom CSS for what is fundamentally a scrolling UI.

CSS now provides two pseudo-elements for scroll containers. `::scroll-button(direction)` creates prev/next buttons that scroll by ~85% of the container's visible area and auto-disable at the ends. `::scroll-marker` on each item creates dot indicators grouped in a `::scroll-marker-group`. Use the `:target-current` pseudo-class to style the active dot. Both are fully stylable with CSS.


### Centering elements without the transform hack

*Layout · Beginner*

The old absolute + transform centering trick took 5 declarations across 2 selectors. Grid does it in 2 properties on the parent.


**Modern approach:**

```css
.parent {
  display: grid;
  place-items: center;
}
```

**Old approach:**

```css
.parent {
 position: relative;
}

.child {
 position: absolute;
 top: 50%;
 left: 50%;
 transform: translate(-50%, -50%);
}
```


**Browser support:** Widely available · Since 2020 · 96% global usage

Browsers: Chrome 57+, Firefox 52+, Safari 10.1+, Edge 16+

[View on caniuse.com →](https://caniuse.com/css-grid) · [View on MDN →](https://developer.mozilla.org/en-US/docs/Web/CSS/place-items) · [Learn more about Baseline →](https://web.dev/blog/announcing-baseline-in-action)


**Why the modern way wins:**

- **Less code** -- 2 properties on the parent vs. 5+ across two selectors. Fewer rules, fewer bugs.
- **Stays in flow** -- No position: absolute means the child stays in document flow. Layout stays predictable.
- **Works on anything** -- Text, images, divs, forms, anything gets centered. No need to know dimensions.


**At a glance:**

- **Lines Saved:** 7 → 2 (71% less code)
- **Old Approach:** 2 selectors (Parent + child rules)
- **Modern Approach:** 1 selector (Parent only)


**How it works:**

The old approach requires `position: relative` on the parent and `position: absolute` + `top: 50%; left: 50%; transform: translate(-50%, -50%)` on the child. That's 5 declarations across 2 selectors, and the child gets pulled out of normal flow.

The modern approach uses `display: grid` on the parent and `place-items: center`, a shorthand for `align-items` + `justify-items`. The child stays in flow, and you don't touch the child's styles at all.


### Corner shapes beyond rounded borders

*Layout · Beginner*

Non-circular corner shapes like squircles, scoops, and notches used to require clip-path polygon hacks or SVG masks. Now corner-shape provides named corner styles natively.


**Modern approach:**

```css
.card {
  border-radius: 2em;
  corner-shape: squircle;
}
```

**Old approach:**

```css
.card {
 clip-path: polygon(
   0% 10%,
   2% 4%,
   4% 2%,
   10% 0%,
   /* ...16 more points */
 );
}

/* Or use an SVG mask image */
/* Neither scales well */
```


**Browser support:** Limited availability · 67% global usage

Browsers: Chrome 133+, Edge 133+

[View on caniuse.com →](https://caniuse.com/css-corner-shape) · [View on webstatus.dev →](https://webstatus.dev/features/corner-shape) · [Learn more about Baseline →](https://web.dev/blog/announcing-baseline-in-action)


**Why the modern way wins:**

- **One property** -- Replace complex polygon hacks or SVG masks with a single corner-shape declaration. Squircle, scoop, notch, bevel — all built in.
- **Works with border-radius** -- corner-shape modifies how border-radius curves are drawn. The radius controls the size, the shape controls the curvature.
- **iOS-style squircles natively** -- The superellipse (squircle) shape used by Apple's design system is now a CSS one-liner. No more approximations.


**At a glance:**

- **Lines Saved:** 12+ → 4 (No polygon hacks)
- **Old Approach:** clip-path (Polygon or SVG mask)
- **Modern Approach:** corner-shape (Named corner styles)


**How it works:**

Apple popularized the superellipse (squircle) for app icons, and developers have been trying to replicate it in CSS ever since. The `border-radius` property only creates circular arcs, so achieving smoother, more continuous curves required clip-path with dozens of polygon points or external SVG masks.

The `corner-shape` property changes how `border-radius` draws its curves. Values include `squircle` (superellipse), `scoop` (concave curve), `notch` (straight cut), and `bevel` (angled cut). It works with existing border-radius values — just add one line to transform any rounded corner into a different shape.


### Customizable selects without a JavaScript library

*Layout · Intermediate*

Styling selects used to require JavaScript libraries like Select2 or Choices.js that replace the native element entirely. Now appearance: base-select unlocks full CSS customization of the native select.


**Modern approach:**

```css
select,
select ::picker(select) {
  appearance: base-select;
}

select option:checked {
  background: var(--accent);
}
```

**Old approach:**

```css
/* JS: replace native select with custom DOM */
import Choices from 'choices.js';
new Choices('#my-select', {
 searchEnabled: false,
});

/* Plus ~30 lines of custom CSS for
  .choices__inner, .choices__list, etc. */
```


**Browser support:** Limited availability · 96% global usage

Browsers: Chrome 135+, Edge 135+

[View on caniuse.com →](https://caniuse.com/css-appearance) · [View on MDN →](https://developer.mozilla.org/en-US/docs/Web/CSS/appearance) · [View on webstatus.dev →](https://webstatus.dev/features/customizable-select) · [Learn more about Baseline →](https://web.dev/blog/announcing-baseline-in-action)


**Why the modern way wins:**

- **Native element** -- Keep the real select with built-in keyboard navigation, form participation, and accessibility for free.
- **Top-layer rendering** -- The dropdown renders in the top layer. No overflow clipping from parent containers.
- **Zero JS, zero dependencies** -- Drop the 30 KB library. Style everything with CSS alone: button, list, options, even the selected content.


**At a glance:**

- **Lines Saved:** 45+ → 8 (No JS or lib CSS)
- **Old Approach:** JS libraries (Select2, Choices.js)
- **Modern Approach:** base-select (appearance: base-select)


**How it works:**

Custom-styled selects have been one of the biggest pain points in web development. The native `<select>` element was essentially un-stylable, so libraries like Select2 and Choices.js replaced it with a fully custom DOM structure. This added weight, broke accessibility, and required constant maintenance.

With `appearance: base-select`, you opt into the new customizable select mode. The browser provides a minimal, fully stylable foundation. You can style the button, the dropdown (`::picker(select)`), individual options, and even use the `<selectedcontent>` element to reflect the selected option's HTML in the button. Rich content like images and icons work inside options natively.


### Dialog light dismiss without click-outside listeners

*Layout · Beginner*

Closing a dialog when the user clicks outside required a JavaScript click listener on the backdrop. The closedby attribute gives dialogs popover-style light dismiss behavior natively.


**Modern approach:**

```css
<dialog closedby="any">
  Click outside or press ESC to close
</dialog>
```

**Old approach:**

```css
/* JS: detect click outside dialog bounds */
dialog.addEventListener('click', (e) => {
 const rect = dialog.getBoundingClientRect();
 if (e.clientX < rect.left ||
     e.clientX > rect.right ||
     e.clientY < rect.top ||
     e.clientY > rect.bottom) {
   dialog.close();
 }
});
```

[View on caniuse.com →](https://caniuse.com/mdn-html_elements_dialog_closedby) · [Learn more about Baseline →](https://web.dev/blog/announcing-baseline-in-action)


**Why the modern way wins:**

- **One attribute** -- Add closedby="any" and the browser handles backdrop clicks and ESC key. No JS event wiring.
- **Consistent behavior** -- Works like popover light dismiss. Users get the same close-on-click-outside pattern everywhere.
- **Three modes** -- none (default), closerequest (ESC only), or any (ESC + backdrop click). Pick the right behavior per dialog.


**At a glance:**

- **Lines Saved:** 12 → 1 (One HTML attribute)
- **Old Approach:** JS click listener (getBoundingClientRect checks)
- **Modern Approach:** closedby attribute (Native light dismiss)


**How it works:**

The `<dialog>` element didn't have a built-in way to close when clicking outside. Developers had to add a click event listener, check if the click was outside the dialog's bounding rect (since clicking the `::backdrop` still fires on the dialog), and then call `dialog.close()`. This was error-prone and needed extra code for ESC handling too.

The `closedby` attribute, available from Chrome 134, brings the popover's light dismiss pattern to dialogs. Set `closedby="any"` for full light dismiss (backdrop click + ESC), `closedby="closerequest"` for ESC-only, or `closedby="none"` to disable user-triggered closing entirely. The browser handles all the hit-testing and keyboard events natively.


### Direction-aware layouts without left and right

*Layout · Intermediate*

You used margin-left, padding-right, border-left, then overrode everything for RTL with [dir="rtl"]. Logical properties are direction-aware so one set of rules works for both.


**Modern approach:**

```css
.box {
  margin-inline-start: 1rem;
  padding-inline-end: 1rem;
  border-block-start: 1px solid;
}
```

**Old approach:**

```css
.box {
 margin-left: 1rem;
 padding-right: 1rem;
}

[dir="rtl"] .box {
 margin-left: 0;
 margin-right: 1rem;
}
/* Duplicate and flip for RTL */
```


**Browser support:** Widely available · Since 2021 · 96% global usage

Browsers: Chrome 87+, Firefox 66+, Safari 14.1+, Edge 87+

[View on caniuse.com →](https://caniuse.com/css-logical-props) · [View on MDN →](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_logical_properties_and_values) · [View on webstatus.dev →](https://webstatus.dev/features/logical-properties) · [Learn more about Baseline →](https://web.dev/blog/announcing-baseline-in-action)


**Why the modern way wins:**

- **One set of rules** -- inline-start and block-start follow writing direction. No [dir="rtl"] overrides.
- **Less code** -- Drop the RTL override block. Logical properties flip automatically when direction changes.
- **Future-proof** -- Works for vertical writing modes too. block and inline mean the same in any direction.


**At a glance:**

- **Lines Saved:** 10+ → 5 (No RTL override block)
- **Old Approach:** left/right + RTL overrides (Duplicate rules for [dir="rtl"])
- **Modern Approach:** Logical properties (inline/block, direction-aware)


**How it works:**

The old approach was to use physical properties like `margin-left`, `padding-right`, `border-left`, then add a `[dir="rtl"]` block that reset and flipped them. That meant maintaining two sets of values and missing one caused layout bugs in RTL.

Logical properties map to the writing mode. `margin-inline-start` is left in LTR and right in RTL. `border-block-start` is top in horizontal writing mode. Use `inline` for start/end (left/right in LTR) and `block` for block-start/block-end (top/bottom). Set `dir` on the document or a container and the same CSS works for both directions.


### Dropdown menus without JavaScript toggles

*Layout · Beginner*

The old way used JS for toggle, click-outside, and ESC, plus manual aria. The popover attribute and popovertarget give you a built-in dismissible popover with no toggle code.


**Modern approach:**

```css
#menu[popover] {
  position: absolute;
  margin: 0.25rem 0;
}
```

**Old approach:**

```css
.menu {
 display: none;
}
.menu.open { display: block; }

/* JS: toggle class, document click-outside,
  keydown ESC, aria-expanded, aria-hidden */
```


**Browser support:** Newly available · Since 2024 · 86% global usage

Browsers: Chrome 114+, Firefox 125+, Safari 17+, Edge 114+

[View on caniuse.com →](https://caniuse.com/mdn-html_global_attributes_popover) · [View on MDN →](https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/popover) · [Polyfill available →](https://github.com/oddbird/popover-polyfill) · [View on webstatus.dev →](https://webstatus.dev/features/popover) · [Learn more about Baseline →](https://web.dev/blog/announcing-baseline-in-action)


**Why the modern way wins:**

- **Built-in toggle** -- Click the button to open, click outside or press ESC to close. No event listeners.
- **Top layer** -- Popover goes in the top layer. No z-index fights with the rest of the page.
- **Accessible** -- The platform handles focus and dismiss. You style the popover and wire the button with popovertarget.


**At a glance:**

- **Lines Saved:** 12+ → 5 (No toggle or dismiss JS)
- **Old Approach:** JS toggle + aria (Click-outside, ESC, aria-expanded)
- **Modern Approach:** popover + popovertarget (Light dismiss, ESC, top layer)


**How it works:**

The old way: a click handler toggles a class that shows or hides the menu. You add a document click listener for click-outside, a keydown listener for Escape, and you manage aria-expanded and aria-hidden yourself. It's easy to miss an edge case.

The modern way: put `popover` on the menu element and `popovertarget="menu"` on the button. The button becomes a popover trigger. Opening, closing, click-outside, and ESC are built in. The menu is rendered in the top layer. You only need CSS to position and style it.


### Filling available space without calc workarounds

*Layout · Beginner*

Making an element fill its container while keeping margins meant calc(100% - left - right) or risking overflow with width: 100%. The stretch keyword fills available space while respecting margins automatically.


**Modern approach:**

```css
.full {
  width: stretch;
}
```

**Old approach:**

```css
.full {
 width: 100%;
 /* overflows if margins are set */

 /* OR: hard-code margin values */
 width: calc(100% - 40px);
}
```


**Browser support:** Limited availability · 90% global usage

Browsers: Chrome 123+, Firefox 116+, Safari 17+, Edge 123+

[View on caniuse.com →](https://caniuse.com/css-width-stretch) · [View on MDN →](https://developer.mozilla.org/en-US/docs/Web/CSS/stretch) · [View on webstatus.dev →](https://webstatus.dev/features/stretch) · [Learn more about Baseline →](https://web.dev/blog/announcing-baseline-in-action)


**Why the modern way wins:**

- **Margin-aware** -- stretch applies to the margin box. Margins are respected without manual subtraction.
- **No overflow** -- Unlike width: 100%, stretch can never overflow the container when margins or padding are present.
- **Works on height too** -- Use height: stretch to fill the block axis. Great for full-height layouts without 100vh quirks.


**At a glance:**

- **Lines Saved:** 6 → 3 (No calc needed)
- **Old Approach:** calc(100% - px) (Manual margin math)
- **Modern Approach:** stretch (Fills available space)


**How it works:**

When you set `width: 100%` on an element with margins, the element overflows its container because 100% refers to the content box of the parent, and margins are added on top. The workaround was `width: calc(100% - 40px)` where you hard-code the exact margin values. Change the margins and you must update the calc too.

The `stretch` keyword resolves to the available space in the containing block, applying the result to the element's margin box instead of the box determined by `box-sizing`. This means the element fills its container exactly, with margins intact, without any manual math. It works on `width`, `height`, `min-width`, `max-height`, and all sizing properties.


### Hover tooltips without JavaScript events

*Layout · Intermediate*

Tooltips required JavaScript mouseenter/mouseleave listeners, focus handling, and manual positioning. Now popover=hint with the interestfor attribute gives you declarative, accessible hover UI.


**Modern approach:**

```css
<button interestfor="tip">
  Hover me
</button>
<div id="tip" popover=hint>
  Tooltip content
</div>
```

**Old approach:**

```css
/* JS: manage hover, focus, and position */
btn.addEventListener('mouseenter', () => {
 tip.hidden = false;
 positionTooltip(btn, tip);
});
btn.addEventListener('mouseleave', () => {
 tip.hidden = true;
});
btn.addEventListener('focus', /* … */);
btn.addEventListener('blur', /* … */);
```


**Browser support:** Limited availability · 86% global usage

Browsers: Chrome 114+, Edge 114+

[View on caniuse.com →](https://caniuse.com/mdn-html_global_attributes_popover) · [View on MDN →](https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/popover) · [View on webstatus.dev →](https://webstatus.dev/features/popover-hint) · [Learn more about Baseline →](https://web.dev/blog/announcing-baseline-in-action)


**Why the modern way wins:**

- **All input modes** -- The browser triggers on hover (mouse), focus (keyboard), and long-press (touch). You write zero event handling.
- **Non-destructive** -- Hint popovers don't close other open auto or manual popovers. Layered UI coexists naturally.
- **Built-in delay** -- The interest-delay property (default 0.5s) prevents accidental triggers. Configurable with CSS.


**At a glance:**

- **Lines Saved:** 14 → 5 (No event listeners)
- **Old Approach:** JS event listeners (mouseenter, mouseleave, focus, blur)
- **Modern Approach:** popover=hint (interestfor + popover=hint)


**How it works:**

Building accessible tooltips required at least four event listeners (mouseenter, mouseleave, focus, blur), a delay mechanism to prevent flicker, position logic, and careful DOM management. Libraries like Tippy.js exist specifically because this is so tedious to get right.

The new `popover=hint` type paired with the `interestfor` attribute handles all of this declaratively. The `interestfor` attribute on the trigger element points to the tooltip's ID. The browser shows the popover when the user 'shows interest' (hover, focus, long-press) and hides it when interest ends. Customize the delay with the `interest-delay` CSS property. Unlike `popover=auto`, hint popovers coexist with other open popovers.


### Modal controls without onclick handlers

*Layout · Beginner*

Opening a dialog modally required onclick handlers calling showModal(). Invoker Commands let buttons perform actions on other elements declaratively with commandfor and command attributes.


**Modern approach:**

```css
<button commandfor="dlg" command="show-modal">
  Open Dialog
</button>

<dialog id="dlg">...</dialog>
```

**Old approach:**

```css
<!-- Inline onclick or JS event listener -->
<button onclick="
 document.querySelector('#dlg')
 .showModal()">
 Open Dialog
</button>

<dialog id="dlg">...</dialog>
```

[View on caniuse.com →](https://caniuse.com/mdn-api_htmlbuttonelement_command) · [Learn more about Baseline →](https://web.dev/blog/announcing-baseline-in-action)


**Why the modern way wins:**

- **Declarative** -- Link a button to its target with commandfor (like the for attribute on labels). No querySelector, no addEventListener.
- **Multiple commands** -- show-modal, close, show-popover, hide-popover, toggle-popover. One pattern for all interactive elements.
- **Custom commands too** -- Prefix with -- for custom commands handled by the command event. Extensible without frameworks.


**At a glance:**

- **Lines Saved:** 8 → 6 (Zero JavaScript)
- **Old Approach:** onclick handlers (Inline JS or addEventListener)
- **Modern Approach:** Invoker Commands (commandfor + command)


**How it works:**

To open a `<dialog>` modally, you needed JavaScript: either an inline `onclick` that calls `showModal()`, or an `addEventListener` in a script. Same for popovers and closing. Every interactive trigger required its own JS wiring.

Invoker Commands (Chrome 135+) add two HTML attributes: `commandfor` takes the ID of the target element, and `command` specifies the action. Built-in commands mirror their JS counterparts: `show-modal`, `close`, `show-popover`, `hide-popover`, `toggle-popover`. Custom commands prefixed with `--` fire a `command` event on the target for extensibility.


### Modal dialogs without a JavaScript library

*Layout · Intermediate*

The old way was a custom overlay plus JavaScript for open/close, ESC key, click-outside, focus trap, and z-index. The dialog element and showModal() handle all of that.


**Modern approach:**

```css
dialog {
  padding: 1rem;
}
dialog::backdrop {
  background: rgb(0 0 0 / .5);
}
```

**Old approach:**

```css
.overlay {
 position: fixed;
 inset: 0;
 background: rgb(0 0 0 / .5);
}

/* JS: addEventListener click, keydown ESC, focus trap,
  aria-hidden, body scroll lock, z-index stacking */
```

[View on caniuse.com →](https://caniuse.com/dialog) · [Learn more about Baseline →](https://web.dev/blog/announcing-baseline-in-action)


**Why the modern way wins:**

- **Built-in behavior** -- ESC to close, click outside to close, and focus trapping come free. No extra JS.
- **Accessible by default** -- The browser manages focus and return focus. Top layer stacking is handled for you.
- **One element** -- No overlay div, no z-index wars. Style dialog and ::backdrop and you are done.


**At a glance:**

- **Lines Saved:** 15+ â†’ 6 (No overlay or focus-trap JS)
- **Old Approach:** Custom overlay + JS (ESC, click-outside, focus trap, z-index)
- **Modern Approach:** dialog + showModal() (::backdrop, top layer)


**How it works:**

The old approach meant a fixed overlay div, JavaScript to open and close it, keydown listeners for Escape, click-outside detection, focus trapping so tab stays inside the modal, and careful z-index management. Easy to get wrong or forget a detail.

The modern approach is a single `<dialog>` element. Call `dialog.showModal()` to open it: the browser puts it in the top layer, traps focus, and provides ESC and click-outside behavior. Style the `::backdrop` pseudo-element for the dimmed background. No overlay div, no focus library.


### Naming grid areas without line numbers

*Layout · Beginner*

The old way was floats with clearfix and margin math, or grid with line numbers. Template areas let you name regions like header, sidebar, main, and drop them in place.


**Modern approach:**

```css
.layout {
  display: grid;
  grid-template-areas: "header header" "sidebar main" "footer footer";
}
```

**Old approach:**

```css
.header { grid-column: 1 / -1; }
.sidebar { grid-column: 1; grid-row: 2; }
.main { grid-column: 2; grid-row: 2; }
.footer { grid-column: 1 / -1; grid-row: 3; }
/* Line numbers, hard to read */
```


**Browser support:** Widely available · Since 2017 · 96% global usage

Browsers: Chrome 57+, Firefox 52+, Safari 10.1+, Edge 16+

[View on caniuse.com →](https://caniuse.com/css-grid) · [View on MDN →](https://developer.mozilla.org/en-US/docs/Web/CSS/grid-template-areas) · [View on webstatus.dev →](https://webstatus.dev/features/grid) · [Learn more about Baseline →](https://web.dev/blog/announcing-baseline-in-action)


**Why the modern way wins:**

- **Readable layout** -- The grid structure is visible at a glance. No counting lines or guessing spans.
- **One place to change** -- Add or remove a row in the template string. Child items use grid-area names only.
- **No line math** -- No grid-column: 1 / 3 or grid-row: 2. Name the area and the browser places it.


**At a glance:**

- **Lines Saved:** 12 → 6 (No line-number placement)
- **Old Approach:** Floats or line numbers (Clearfix, margin hacks, or grid-column/row)
- **Modern Approach:** Named areas (grid-template-areas + grid-area)


**How it works:**

The old approach was either float-based layouts with clearfix and tricky margins, or grid with explicit `grid-column` and `grid-row` line numbers. Line numbers work but are hard to read and refactor.

The modern approach is `grid-template-areas`: you write a string that looks like your layout. Each quoted row lists area names; repeat a name to span columns. Then on each child you set `grid-area: header` (or whatever name). The layout is defined in one place and reads like a simple map.


### Positioning shorthand without four properties

*Layout · Beginner*

The old way was to set top, right, bottom, and left one by one for full-bleed or overlay layouts. inset gives you one property that sets all four.


**Modern approach:**

```css
.overlay {
  position: absolute;
  inset: 0;
}
```

**Old approach:**

```css
.overlay {
 position: absolute;
 top: 0;
 right: 0;
 bottom: 0;
 left: 0;
}
```


**Browser support:** Widely available · Since 2021 · 93% global usage

Browsers: Chrome 87+, Firefox 66+, Safari 14.1+, Edge 87+

[View on caniuse.com →](https://caniuse.com/mdn-css_properties_inset) · [View on MDN →](https://developer.mozilla.org/en-US/docs/Web/CSS/inset) · [View on webstatus.dev →](https://webstatus.dev/features/inset) · [Learn more about Baseline →](https://web.dev/blog/announcing-baseline-in-action)


**Why the modern way wins:**

- **One line** -- One property instead of four. Same effect, less repetition and fewer chances to forget a side.
- **Same as margin/padding** -- inset follows the same multi-value pattern: one value for all, two for vertical/horizontal, four for each side.
- **Readable** -- inset: 0 reads as "pin to all edges." Clear intent for overlays and full-bleed positioned elements.


**At a glance:**

- **Lines Saved:** 6 → 4 (33% less code)
- **Old Approach:** Four properties (top, right, bottom, left)
- **Modern Approach:** inset shorthand (One declaration)


**How it works:**

The old way: for a full-bleed overlay or any positioned element that should stretch to all edges, you set `top: 0; right: 0; bottom: 0; left: 0`. Four declarations, easy to miss one or get the order wrong.

The modern way: use `inset: 0`. It sets all four sides in one shot. You can use one value (all sides), two (vertical, horizontal), or four (top, right, bottom, left). Same syntax idea as margin or padding. Works with absolute, fixed, and sticky.


### Preventing layout shift from scrollbar appearance

*Layout · Beginner*

When content grows tall enough to scroll, the scrollbar appears and narrows the layout, causing a visible jump. The old fixes were overflow-y: scroll (always shows the bar) or padding-right matching the scrollbar width. scrollbar-gutter: stable reserves the space upfront.


**Modern approach:**

```css
body {
  scrollbar-gutter: stable;
}
```

**Old approach:**

```css
/* Option 1: always show scrollbar (ugly on short pages) */
body { overflow-y: scroll; }
/* Option 2: hardcode scrollbar width (fragile) */
body { padding-right: 17px; }
/* scrollbar width varies by OS and browser */
```


**Browser support:** Newly available · Since 2024 · 90% global usage

Browsers: Chrome 94+, Firefox 97+, Safari 18.2+, Edge 94+

[View on caniuse.com →](https://caniuse.com/mdn-css_properties_scrollbar-gutter) · [View on MDN →](https://developer.mozilla.org/en-US/docs/Web/CSS/scrollbar-gutter) · [View on webstatus.dev →](https://webstatus.dev/features/scrollbar-gutter) · [Learn more about Baseline →](https://web.dev/blog/announcing-baseline-in-action)


**Why the modern way wins:**

- **No layout shift** -- Space is reserved before the scrollbar appears. The page doesn't jump when content grows past the viewport.
- **No hardcoded widths** -- The browser reserves the correct amount automatically. No 17px magic numbers that break across platforms.
- **both keyword** -- scrollbar-gutter: stable both reserves space on both sides for symmetric layouts like centered content.


**At a glance:**

- **Lines Saved:** 6 → 3 (No fragile padding hack)
- **Old Approach:** overflow-y: scroll (Always-visible bar or hardcoded padding)
- **Modern Approach:** scrollbar-gutter (Reserve space, hide until needed)


**How it works:**

When a page gains enough content to scroll, the classic scrollbar appears and shrinks the content area — a visible jump. Two common fixes existed: `overflow-y: scroll` keeps the scrollbar always visible even on short pages, or `padding-right: 17px` hardcodes the scrollbar width, which varies across OSes and browsers.

`scrollbar-gutter: stable` reserves the scrollbar track space before the scrollbar appears. The layout width stays the same whether the page is scrollable or not. Important: on systems with overlay scrollbars — the default on macOS and iOS — this property has no visible effect since overlay scrollbars float on top of content rather than occupying layout space. To test it on macOS, go to System Settings → Appearance → Show scroll bars → Always.


### Preventing scroll chaining without JavaScript

*Layout · Beginner*

When a scrollable element inside a modal reached its end, scroll would chain to the page behind it. The fix was a JS wheel event listener calling e.preventDefault(). overscroll-behavior: contain stops that natively.


**Modern approach:**

```css
.modal-content {
  overflow-y: auto;
  overscroll-behavior: contain;
}
```

**Old approach:**

```css
.modal-content { overflow-y: auto; }
// JS: prevent scroll chaining on wheel and touch
modal.addEventListener('wheel', (e) => {
 e.preventDefault();
}, { passive: false });
// also needed for touch: touchmove listener
```


**Browser support:** Widely available · Since 2022 · 96% global usage

Browsers: Chrome 63+, Firefox 59+, Safari 16+, Edge 18+

[View on caniuse.com →](https://caniuse.com/css-overscroll-behavior) · [View on MDN →](https://developer.mozilla.org/en-US/docs/Web/CSS/overscroll-behavior) · [View on webstatus.dev →](https://webstatus.dev/features/overscroll-behavior) · [Learn more about Baseline →](https://web.dev/blog/announcing-baseline-in-action)


**Why the modern way wins:**

- **No JavaScript** -- No wheel or touchmove event listener, no preventDefault, no passive flag concerns.
- **Works on touch too** -- Handles touch scroll chaining on mobile without the complexity of non-passive event listeners.
- **Pull-to-refresh too** -- overscroll-behavior: none also prevents pull-to-refresh on Chrome Android for full-screen app-like layouts.


**At a glance:**

- **Lines Saved:** 8 → 4 (No wheel event handler)
- **Old Approach:** e.preventDefault() (wheel and touchmove event listeners)
- **Modern Approach:** overscroll-behavior (CSS scroll containment)


**How it works:**

Scrollable panels inside modals or dropdowns would chain scroll to the page once the panel reached its end. Stopping this required non-passive wheel and touchmove event listeners calling `e.preventDefault()`, which also blocked the browser's scroll optimizations and required separate handling for touch.

`overscroll-behavior: contain` stops scroll propagation at the element's boundary. The inner element scrolls normally, but the chain ends there. `overscroll-behavior: none` additionally prevents the bounce effect and pull-to-refresh on supported platforms.


### Responsive components without media queries

*Layout · Intermediate*

Media queries respond to the viewport. Components live in containers: sidebars, modals, grids. @container lets them respond to their actual available space.


**Modern approach:**

```css
.wrapper {
  container-type: inline-size;
}

.card {
  display: grid;
  grid-template-columns: 1fr;
}

@container (width > 400px) {
  .card {
    grid-template-columns: auto 1fr;
  }
}
```

**Old approach:**

```css
.card {
 display: grid;
 grid-template-columns: 1fr;
}

@media (min-width: 768px) {
 .card {
   grid-template-columns: auto 1fr;
 }
}
/* Breaks when .card is in a sidebar */
```


**Browser support:** Widely available · Since 2023 · 93% global usage

Browsers: Chrome 105+, Firefox 110+, Safari 16+, Edge 105+

[View on caniuse.com →](https://caniuse.com/css-container-queries) · [View on MDN →](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_containment/Container_queries) · [View on webstatus.dev →](https://webstatus.dev/features/container-queries) · [Learn more about Baseline →](https://web.dev/blog/announcing-baseline-in-action)


**Why the modern way wins:**

- **Component-level responsive** -- Components adapt to their own container. Same card works in a sidebar, modal, or full-width grid.
- **Truly reusable** -- No more breakpoint math for every context. The component carries its responsive logic with it.
- **Precise control** -- Query the nearest container, not the whole viewport. Each section of the page can behave independently.


**At a glance:**

- **Key Change:** Scope (Viewport → Container)
- **Old Approach:** @media (Viewport-dependent)
- **Modern Approach:** @container (Context-aware)


**How it works:**

First, mark a parent as a container with `container-type: inline-size`. This tells the browser to track its width for query purposes.

Then use `@container (width > 400px)` instead of `@media`. The query now fires based on the container's width, not the viewport. Your card can be 300px wide in a sidebar and 800px wide in a main area, and it'll adapt correctly in both.

You can even name containers with `container-name` to target specific ancestors when nesting multiple containers.


### Responsive images without the background-image hack

*Layout · Beginner*

Cropped responsive images were done with background-image and background-size: cover on a div. No semantic img element, no alt text, and no native lazy loading. object-fit brings the same cropping behavior to real img elements.


**Modern approach:**

```css
img {
  object-fit: cover;
  object-position: center;
  width: 100%;
  height: 200px;
}
```

**Old approach:**

```css
<!-- div instead of img: no alt, not semantic -->
<div class="card-image"></div>
.card-image {
 background-image: url(photo.jpg);
 background-size: cover;
 background-position: center;
}
```


**Browser support:** Widely available · Since 2022 · 96% global usage

Browsers: Chrome 32+, Firefox 36+, Safari 10.1+, Edge 16+

[View on caniuse.com →](https://caniuse.com/object-fit) · [View on MDN →](https://developer.mozilla.org/en-US/docs/Web/CSS/object-fit) · [View on webstatus.dev →](https://webstatus.dev/features/object-fit) · [Learn more about Baseline →](https://web.dev/blog/announcing-baseline-in-action)


**Why the modern way wins:**

- **Semantic HTML** -- A real img element with alt text. Screen readers and search engines see the image correctly.
- **Native lazy loading** -- img supports loading="lazy" natively. Background images require Intersection Observer to achieve the same.
- **object-position** -- Control which part of the image is visible with object-position. Same concept as background-position.


**At a glance:**

- **Lines Saved:** 7 → 5 (Real img element)
- **Old Approach:** background-image (Div with background-size: cover)
- **Modern Approach:** object-fit: cover (Native img with CSS cropping)


**How it works:**

Cropped images in card layouts used `background-image` on a div with `background-size: cover`. Visually it worked, but it meant no `<img>` element, no `alt` attribute, no native lazy loading, and no `srcset` for responsive images.

`object-fit: cover` applies directly to an `<img>` element. The image fills its container and is cropped to fit, just like `background-size: cover`. `object-position` controls which part stays visible, matching `background-position`. The image stays semantic, accessible, and gets native browser optimization.


### Scroll snapping without a carousel library

*Layout · Intermediate*

Carousels used to mean Slick, Swiper, or custom scroll math. CSS scroll snap gives you card-by-card or full-width snapping with a few properties.


**Modern approach:**

```css
.carousel {
  scroll-snap-type: x mandatory;
  overflow-x: auto;
  display: flex;
  gap: 1rem;
}
.carousel > * { scroll-snap-align: start; }
```

**Old approach:**

```css
// carousel.js + Slick/Swiper
import Swiper from 'swiper';
new Swiper('.carousel', {
 slidesPerView: 1.2,
 spaceBetween: 16,
 scrollbar: { el: '.swiper-scrollbar' },
 touchEventsTarget: 'container'
});
```


**Browser support:** Widely available · Since 2020 · 96% global usage

Browsers: Chrome 69+, Firefox 68+, Safari 11+, Edge 79+

[View on caniuse.com →](https://caniuse.com/css-snappoints) · [View on MDN →](https://developer.mozilla.org/en-US/docs/Web/CSS/scroll-snap-type) · [View on webstatus.dev →](https://webstatus.dev/features/scroll-snap) · [Learn more about Baseline →](https://web.dev/blog/announcing-baseline-in-action)


**Why the modern way wins:**

- **No library** -- No Slick, Swiper, or custom scroll math. Just CSS on a scroll container.
- **Native touch** -- Touch and trackpad scrolling work out of the box. No touchstart handlers.
- **Accessible** -- Real overflow scroll, so keyboard and screen readers get normal scroll behavior.


**At a glance:**

- **Lines Saved:** 12+ → 6 (No JS dependency)
- **Old Approach:** JS carousel lib (Slick, Swiper, touch handlers)
- **Modern Approach:** scroll-snap CSS (Native snapping)


**How it works:**

Carousels were usually built with a JS library that handled scroll position, touch events, and snap calculations. You paid in bundle size and maintenance.

`scroll-snap-type: x mandatory` on a scroll container plus `scroll-snap-align: start` (or `center`) on each item gives you snapping. Use `overflow-x: auto` and flex/grid for the layout. No JS.


### Spacing elements without margin hacks

*Layout · Beginner*

The old way used margins on children and negative margin on the container, or :last-child to cancel the last margin. Gap handles it on the parent.


**Modern approach:**

```css
.grid {
  display: flex;
  gap: 16px;
}
```

**Old approach:**

```css
.grid {
 display: flex;
}

.grid > * {
 margin-right: 16px;
}
.grid > *:last-child { margin-right: 0; }
```


**Browser support:** Widely available · Since 2021 · 95% global usage

Browsers: Chrome 84+, Firefox 63+, Safari 14.1+, Edge 84+

[View on caniuse.com →](https://caniuse.com/flexbox-gap) · [View on MDN →](https://developer.mozilla.org/en-US/docs/Web/CSS/gap) · [View on webstatus.dev →](https://webstatus.dev/features/flexbox-gap) · [Learn more about Baseline →](https://web.dev/blog/announcing-baseline-in-action)


**Why the modern way wins:**

- **No edge cases** -- Gap only goes between items. No need to zero out the last child or use negative margins.
- **Parent controls spacing** -- One value on the container. Add or remove children, spacing stays consistent.
- **Flex and grid** -- Same gap property works for both. Row and column gap available too.


**At a glance:**

- **Lines Saved:** 6 → 3 (50% less code)
- **Old Approach:** Margin on children (:last-child override)
- **Modern Approach:** Gap on parent (One property)


**How it works:**

The old pattern was margin on every child (e.g. margin-right: 16px) and then a :last-child rule to set margin to 0 so the last item didn't add extra space. Or you used negative margin on the container to absorb the last child's margin. Both are fiddly.

With `display: flex` or `grid` and `gap: 16px`, the browser adds space only between items. No child margins, no overrides. Works the same for rows and columns, and you can use `row-gap` and `column-gap` separately if needed.


### Sticky headers without JavaScript scroll listeners

*Layout · Beginner*

The old way used JavaScript scroll events and getBoundingClientRect to toggle a class. Sticky positioning does it in one property.


**Modern approach:**

```css
.header {
  position: sticky;
  top: 0;
}
```

**Old approach:**

```css
// JavaScript: scroll listener
window.addEventListener('scroll', () => {
 const rect = header.getBoundingClientRect();
 if (rect.top <= 0) header.classList.add('fixed');
 else header.classList.remove('fixed');
});

.header.fixed {
 position: fixed;
 top: 0;
}
```


**Browser support:** Widely available · Since 2022 · 96% global usage

Browsers: Chrome 56+, Firefox 32+, Safari 13+, Edge 16+

[View on caniuse.com →](https://caniuse.com/css-sticky) · [View on MDN →](https://developer.mozilla.org/en-US/docs/Web/CSS/position) · [View on webstatus.dev →](https://webstatus.dev/features/sticky-positioning) · [Learn more about Baseline →](https://web.dev/blog/announcing-baseline-in-action)


**Why the modern way wins:**

- **No JavaScript** -- The browser handles scroll. No listeners, no getBoundingClientRect, no class toggles.
- **Respects flow** -- Sticky stays in layout until it hits the threshold, then sticks. No layout jumps.
- **One property** -- Set position and top. Works for headers, sidebars, or any element you want to pin.


**At a glance:**

- **Lines Saved:** 15+ → 3 (No JS needed)
- **Old Approach:** Scroll listener + class (JS + getBoundingClientRect)
- **Modern Approach:** One property (position: sticky)


**How it works:**

The old way meant a scroll listener, reading getBoundingClientRect on every scroll, and toggling a class to switch between normal and fixed. That's JS, reflows, and extra CSS for the fixed state.

With `position: sticky` and `top: 0`, the header stays in flow until it would scroll past the top, then it sticks. The browser does the work. No script, no class, no layout hacks.


### Tooltip positioning without JavaScript

*Layout · Advanced*

The old way relied on JS libraries like Popper.js or Floating UI to compute tooltip position. CSS anchor positioning ties the tooltip to its trigger with anchor-name and position-anchor.


**Modern approach:**

```css
.trigger { anchor-name: --tip; }
.tooltip { position-anchor: --tip; top: anchor(bottom); }
```

**Old approach:**

```css
/* JS: getBoundingClientRect for trigger + tooltip,
  compute top/left, handle scroll/resize */

.tooltip {
 position: fixed;
 top: var(--computed-top);
 left: var(--computed-left);
}
```


**Browser support:** Limited availability · 77% global usage

Browsers: Chrome 125+, Firefox 134+, Edge 125+

[View on caniuse.com →](https://caniuse.com/css-anchor-positioning) · [View on MDN →](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_anchor_positioning) · [Polyfill available →](https://github.com/oddbird/css-anchor-positioning) · [View on webstatus.dev →](https://webstatus.dev/features/anchor-positioning) · [Learn more about Baseline →](https://web.dev/blog/announcing-baseline-in-action)


**Why the modern way wins:**

- **No layout thrash** -- The browser keeps tooltip and trigger in sync. No JS measuring or scroll listeners.
- **Declarative** -- You say where the tooltip goes relative to the anchor. The engine does the math.
- **Drop the library** -- Popper.js and Floating UI are great, but for simple tooltips you can skip them entirely.


**At a glance:**

- **Lines Saved:** 10+ → 6 (No JS positioning)
- **Old Approach:** JS libraries (Popper.js, Floating UI)
- **Modern Approach:** CSS anchor positioning (anchor-name, position-anchor)


**How it works:**

The old way was to use a library like Popper.js or Floating UI: JavaScript reads the trigger and tooltip rects, computes top/left, sets them (often via CSS variables or inline styles), and subscribes to scroll and resize to update. It works but adds weight and complexity.

The modern way is CSS anchor positioning. Give the trigger `anchor-name: --tip`. On the tooltip, set `position-anchor: --tip` and use `top: anchor(bottom)` (or other anchor() sides). The browser keeps the tooltip positioned relative to the trigger. No JavaScript required.



---

### Category: Animation

### Animating display none without workarounds

*Animation · Intermediate*

You couldn't transition display. Workarounds were JS that set display: none after transition end, or visibility plus opacity and pointer-events. Now discrete properties can participate.


**Modern approach:**

```css
.panel {
  transition: opacity .2s, overlay .2s allow-discrete;
  transition-behavior: allow-discrete;
}
.panel.hidden {
  opacity: 0;
  display: none;
}
```

**Old approach:**

```css
.panel { transition: opacity .2s; }
.panel.hidden { opacity: 0; visibility: hidden; }
// JS: after transition, set display:none and pointer-events
el.addEventListener('transitionend', () => {
 el.style.display = 'none';
});
```


**Browser support:** Newly available · Since 2024 · 85% global usage

Browsers: Chrome 117+, Firefox 129+, Safari 17.4+, Edge 117+

[View on caniuse.com →](https://caniuse.com/mdn-css_properties_transition-behavior) · [View on MDN →](https://developer.mozilla.org/en-US/docs/Web/CSS/transition-behavior) · [View on webstatus.dev →](https://webstatus.dev/features/transition-behavior) · [Learn more about Baseline →](https://web.dev/blog/announcing-baseline-in-action)


**Why the modern way wins:**

- **Real display** -- Animate to display: none. No need to keep the element in the layout with visibility.
- **No transitionend** -- Browser handles the discrete flip at the right time. No JS listening for transitionend.
- **Overlay too** -- overlay is another discrete property. Useful for popovers and modals.


**At a glance:**

- **Lines Saved:** 15 → 6 (No JS for hide)
- **Old Approach:** visibility + JS (transitionend then display:none)
- **Modern Approach:** allow-discrete (Animate display and overlay)


**How it works:**

display isn't interpolable, so it was left out of transitions. To hide after a fade you either listened for transitionend in JS and then set display: none, or you kept the element in layout with visibility: hidden and pointer-events: none so it didn't block clicks.

`transition-behavior: allow-discrete` lets discrete properties like `display` and `overlay` participate. The browser runs the interpolable transition (e.g. opacity), then flips the discrete value at the right moment. No JS.


### Entry animations without JavaScript timing

*Animation · Intermediate*

Transitions only ran when a value changed. To animate in, you added a class in JS after paint. @starting-style defines the before state so CSS can transition from it.


**Modern approach:**

```css
.card {
  transition: opacity .3s, transform .3s;
  @starting-style {
    opacity: 0;
    transform: translateY(10px);
  }
}
```

**Old approach:**

```css
.card { opacity: 0; transform: translateY(10px); }
.card.visible { opacity: 1; transform: none; }
// JS: must run after paint or transition won't run
requestAnimationFrame(() => {
 requestAnimationFrame(() => {
   el.classList.add('visible');
 });
});
```


**Browser support:** Newly available · Since 2024 · 85% global usage

Browsers: Chrome 117+, Firefox 129+, Safari 17.5+, Edge 117+

[View on caniuse.com →](https://caniuse.com/mdn-css_at-rules_starting-style) · [View on MDN →](https://developer.mozilla.org/en-US/docs/Web/CSS/@starting-style) · [View on webstatus.dev →](https://webstatus.dev/features/starting-style) · [Learn more about Baseline →](https://web.dev/blog/announcing-baseline-in-action)


**Why the modern way wins:**

- **No JS timing** -- No double rAF or setTimeout. The browser knows the starting state from CSS.
- **Declarative** -- Entry and transition live in one place. Works with dynamic content and frameworks.
- **Same transition** -- Uses your existing transition properties. No separate keyframes for enter.


**At a glance:**

- **Lines Saved:** 10 → 6 (No JS for entry)
- **Old Approach:** Class after paint (rAF or setTimeout)
- **Modern Approach:** @starting-style (CSS-defined start state)


**How it works:**

CSS transitions only run when a property changes. If an element appears with opacity: 0 and you want it to transition to 1, the browser never saw the 0, so you had to set the initial state, then add a class in the next frame (requestAnimationFrame, or double rAF) so the change was detected.

`@starting-style` lets you define the style that applies at the moment the element is first rendered. The browser uses that as the from state and transitions to the element's actual styles. No JavaScript, no timing hacks.


### Independent transforms without the shorthand

*Animation · Beginner*

transform was one shorthand. To change only rotation you had to repeat translate and scale. Now translate, rotate, and scale are separate properties you can animate on their own.


**Modern approach:**

```css
.icon {
  translate: 10px 0;
  rotate: 45deg;
  scale: 1.2;
}
.icon:hover {
  rotate: 90deg;
}
```

**Old approach:**

```css
.icon {
 transform: translateX(10px) rotate(45deg) scale(1.2);
}
.icon:hover {
 transform: translateX(10px) rotate(90deg) scale(1.2);
 /* must repeat translate and scale */
```


**Browser support:** Widely available · Since 2022 · 92% global usage

Browsers: Chrome 104+, Firefox 72+, Safari 14.1+, Edge 104+

[View on caniuse.com →](https://caniuse.com/mdn-css_properties_translate) · [View on MDN →](https://developer.mozilla.org/en-US/docs/Web/CSS/translate) · [View on webstatus.dev →](https://webstatus.dev/features/individual-transforms) · [Learn more about Baseline →](https://web.dev/blog/announcing-baseline-in-action)


**Why the modern way wins:**

- **Change one, keep the rest** -- Update only rotate or scale. No copying the whole transform string.
- **Easier animation** -- Animate translate and rotate in different keyframes or with different timing.
- **Same order** -- translate, rotate, scale always apply in that order. No shorthand order gotchas.


**At a glance:**

- **Lines Saved:** Less repetition (No duplicate transform values)
- **Old Approach:** Single transform (Rewrite all to change one)
- **Modern Approach:** Separate properties (translate, rotate, scale)


**How it works:**

With `transform: translateX(10px) rotate(45deg) scale(1.2)`, changing just the angle on hover meant repeating the whole list. Easy to get out of sync or miss a value.

The individual properties `translate`, `rotate`, and `scale` do the same thing but live on their own. You can set or animate any one without touching the others. They still combine into one transform in a fixed order: translate, then rotate, then scale.


### Page transitions without a framework

*Animation · Advanced*

Page transitions used to need Barba.js or React Transition Group. The View Transitions API gives you cross-fades and shared-element motion with one JS call and CSS.


**Modern approach:**

```css
document.startViewTransition(() => {
  document.body.innerHTML = newContent;
});

.hero { view-transition-name: hero; }
```

**Old approach:**

```css
// barba.js or custom router transitions
import Barba from '@barba/core';
Barba.init({
 transitions: [{
   name: 'fade',
   leave({ current }) { â€¦ },
   enter({ next }) { â€¦ }
 }]
});
```


**Browser support:** Newly available · Since 2024 · 89% global usage

Browsers: Chrome 111+, Firefox 130+, Safari 18.2+, Edge 111+

[View on caniuse.com →](https://caniuse.com/view-transitions) · [View on MDN →](https://developer.mozilla.org/en-US/docs/Web/API/View_Transitions_API) · [Polyfill available →](https://github.com/demarketed/view-transitions-polyfill) · [View on webstatus.dev →](https://webstatus.dev/features/view-transitions) · [Learn more about Baseline →](https://web.dev/blog/announcing-baseline-in-action)


**Why the modern way wins:**

- **One API** -- Wrap your DOM update in startViewTransition. Browser handles capture, transition, and paint.
- **Shared elements** -- view-transition-name links old and new elements. Morph between them with CSS.
- **Framework-agnostic** -- Works with vanilla JS, React, or any stack. No router lock-in.


**At a glance:**

- **Lines Saved:** 20+ → 8 (No transition lib)
- **Old Approach:** Barba / React TG (Custom leave/enter hooks)
- **Modern Approach:** View Transitions API (Native capture and animate)


**How it works:**

Smooth page-to-page or view-to-view transitions usually meant a library that ran leave animations, swapped content, then ran enter animations. You managed state and timing yourself.

`document.startViewTransition(callback)` runs your callback (e.g. update the DOM), and the browser captures the before state, applies the update, captures the after state, then animates between them. Use `view-transition-name` on elements that should match across views for shared-element effects. Style with `::view-transition-old()` and `::view-transition-new()`.


### Responsive clip paths without SVG

*Animation · Advanced*

Complex clip paths used to require SVG path() definitions with fixed coordinates that don't scale responsively. The CSS shape() function uses responsive units like percentages and viewport units for truly flexible shapes.


**Modern approach:**

```css
.shape {
  clip-path: shape(
    from 0% 100%,
    line to 50% 0%,
    line to 100% 100%
  );
}
```

**Old approach:**

```css
.shape {
 clip-path: path(
   'M0 200 L100 0 L200 200 Z'
 );
}

/* Fixed pixel coordinates */
/* Doesn't scale with element size */
```


**Browser support:** Limited availability · 96% global usage

Browsers: Chrome 137+, Edge 137+

[View on caniuse.com →](https://caniuse.com/css-clip-path) · [View on MDN →](https://developer.mozilla.org/en-US/docs/Web/CSS/basic-shape/shape) · [View on webstatus.dev →](https://webstatus.dev/features/clip-path) · [Learn more about Baseline →](https://web.dev/blog/announcing-baseline-in-action)


**Why the modern way wins:**

- **Responsive by default** -- Use percentages, em, rem, vw — any CSS unit. The shape scales with the element, unlike fixed-coordinate SVG paths.
- **CSS-native syntax** -- No SVG path mini-language to learn. Uses familiar CSS commands: line, curve, arc, smooth, with readable coordinate pairs.
- **Animatable** -- Unlike path(), shape() can be animated and transitioned between different shapes smoothly with CSS animations.


**At a glance:**

- **Scalability:** Responsive (Uses %, em, vw)
- **Old Approach:** path() (Fixed SVG coordinates)
- **Modern Approach:** shape() (CSS-native function)


**How it works:**

The SVG `path()` function brought complex shapes to CSS clip-path, but it inherited SVG's fixed coordinate system. A path defined with `M0 200 L100 0 L200 200` only works for a 200×200 element. Resize it, and the clipping breaks.

The CSS `shape()` function solves this by using standard CSS coordinates and units. You write `from 0% 100%, line to 50% 0%, line to 100% 100%` — readable, responsive, and animatable. It supports lines, curves (quadratic and cubic), arcs, and smooth joins, all with CSS units that scale with the element.


### Scroll-linked animations without a library

*Animation · Advanced*

Fade-in-on-scroll used to mean IntersectionObserver, GSAP, or AOS.js. CSS can now trigger animations based on scroll position, zero JavaScript, smooth 60fps.


**Modern approach:**

```css
@keyframes reveal {
  from { opacity: 0; translate: 0 40px; }
  to   { opacity: 1; translate: 0 0; }
}

.reveal {
  animation: reveal linear both;
  animation-timeline: view();
  animation-range: entry 0% entry 100%;
}
```

**Old approach:**

```css
// scroll-reveal.js
const obs = new IntersectionObserver(
 (entries) => {
   entries.forEach(e => {
     if (e.isIntersecting)
       e.target.classList.add('visible');
   });
 }
);
document.querySelectorAll('.reveal')
 .forEach(el => obs.observe(el));
```


**Browser support:** Limited availability · 78% global usage

Browsers: Chrome 115+, Safari 18+, Edge 115+

[View on caniuse.com →](https://caniuse.com/mdn-css_properties_animation-timeline) · [View on MDN →](https://developer.mozilla.org/en-US/docs/Web/CSS/animation-timeline) · [Polyfill available →](https://github.com/flackr/scroll-timeline) · [View on webstatus.dev →](https://webstatus.dev/features/scroll-driven-animations) · [Learn more about Baseline →](https://web.dev/blog/announcing-baseline-in-action)


**Why the modern way wins:**

- **GPU-accelerated** -- Runs on the compositor thread, 60fps guaranteed. No main-thread jank from JS observers or scroll handlers.
- **No JavaScript at all** -- Drop GSAP, AOS.js, or custom IntersectionObserver code. Entire scroll animation in 4 lines of CSS.
- **Reversible by default** -- Scroll back up and the animation reverses naturally. No need for "unobserve" or state management.


**At a glance:**

- **Lines Saved:** 11 → 4 (JS + CSS → pure CSS)
- **Old Approach:** JS runtime (Main thread blocking)
- **Modern Approach:** Compositor (GPU-accelerated)


**How it works:**

`animation-timeline: view()` binds a standard `@keyframes` animation to the element's visibility in the scroll port. As the element scrolls into view, the animation progresses from 0% to 100%.

`animation-range: entry 0% entry 100%` means the animation plays fully during the "entry" phase, from the moment the element's edge appears to when it's fully visible. You can also use `exit`, `cover`, or `contain` ranges.

Since this uses the browser's animation engine (compositor thread), it's inherently smoother than any JavaScript approach that mutates styles on the main thread.


### Smooth height auto animations without JavaScript

*Animation · Beginner*

Animating to height: auto required JS to measure scrollHeight, set a fixed pixel height, then snap back to auto. interpolate-size: allow-keywords lets CSS transition directly to and from intrinsic sizes.


**Modern approach:**

```css
:root { interpolate-size: allow-keywords; }
.accordion {
  height: 0;
  overflow: hidden;
  transition: height .3s ease;
}
.accordion.open { height: auto; }
```

**Old approach:**

```css
.accordion { overflow: hidden; }
// JS: measure height, animate to px, then snap to auto
function open(el) {
 el.style.height = el.scrollHeight + 'px';
 el.addEventListener('transitionend', () => {
   el.style.height = 'auto';
 }, { once: true });
}
```


**Browser support:** Newly available · Since 2024 · 69% global usage

Browsers: Chrome 129+, Firefox 131+, Safari 18.2+, Edge 129+

[View on caniuse.com →](https://caniuse.com/mdn-css_properties_interpolate-size) · [View on MDN →](https://developer.mozilla.org/en-US/docs/Web/CSS/interpolate-size) · [View on webstatus.dev →](https://webstatus.dev/features/interpolate-size) · [Learn more about Baseline →](https://web.dev/blog/announcing-baseline-in-action)


**Why the modern way wins:**

- **No JS needed** -- No scrollHeight measurement, no transitionend listener, no pixel-to-auto snap.
- **Works with any keyword** -- Transitions to and from auto, min-content, max-content, and fit-content all work with one declaration.
- **Set it once** -- Declaring interpolate-size on :root unlocks keyword size transitions everywhere on the page.


**At a glance:**

- **Lines Saved:** 10 → 6 (No JS height measurement)
- **Old Approach:** scrollHeight + JS (Measure, set px, then snap to auto)
- **Modern Approach:** interpolate-size (Transition to height: auto directly)


**How it works:**

height: auto isn't animatable because the browser can't interpolate between a fixed length and a keyword. The workaround was JavaScript: read scrollHeight to get the actual pixel height, set it as a fixed value, trigger the transition, then snap back to auto on transitionend.

`interpolate-size: allow-keywords` opts the browser into animating keyword sizes. Set it on `:root` once and transitions to `height: auto`, `width: fit-content`, and other intrinsic sizes work everywhere on the page. No JavaScript, no scrollHeight, no transitionend.


### Staggered animations without nth-child hacks

*Animation · Intermediate*

Staggered list animations used to require manually setting --index on each :nth-child or counting in JavaScript. The sibling-index() function gives every element automatic awareness of its position.


**Modern approach:**

```css
li {
  transition: opacity .25s ease, translate .25s ease;
  transition-delay:
    calc(0.1s * (sibling-index() - 1));
}
```

**Old approach:**

```css
/* Manual index per nth-child */
li:nth-child(1) { --i: 0; }
li:nth-child(2) { --i: 1; }
li:nth-child(3) { --i: 2; }
li:nth-child(4) { --i: 3; }
/* … repeat for every item … */

li {
 transition-delay: calc(0.1s * var(--i));
}
```


**Browser support:** Limited availability · 70% global usage

Browsers: Chrome 138+, Edge 138+, Safari 26.2+

[View on caniuse.com →](https://caniuse.com/wf-sibling-count) · [View on MDN →](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/sibling-index) · [Learn more about Baseline →](https://web.dev/blog/announcing-baseline-in-action)


**Why the modern way wins:**

- **Automatic indexing** -- sibling-index() returns each element's 1-based position. No manual counting, no matter how many items.
- **Dynamic safe** -- Add or remove items and the stagger adapts automatically. The old nth-child approach breaks when the list changes.
- **Count siblings too** -- sibling-count() gives the total. Use both for radial layouts, equal distribution, and more.


**At a glance:**

- **Lines Saved:** 12+ → 5 (Scales to any list size)
- **Old Approach:** nth-child per item (Manual --index variables)
- **Modern Approach:** sibling-index() (Tree counting functions)


**How it works:**

The classic staggered animation technique required setting a custom property like `--i` on every `:nth-child` selector, then using `calc(0.1s * var(--i))` for the delay. This was fragile: add a list item and you need another rule. Some developers set the index via inline styles or JavaScript instead, adding complexity.

The `sibling-index()` function returns a 1-based integer representing the element's position among its siblings. Use it directly in `calc()` for staggered delays, radial positioning, or any layout that depends on element order. Its companion `sibling-count()` returns the total number of siblings, enabling formulas like distributing items evenly around a circle.


### Sticky & snapped element styling without JavaScript

*Animation · Intermediate*

Styling elements differently when they become stuck (sticky) or snapped used to require JavaScript scroll event listeners. scroll-state() container queries let CSS respond to scroll-related states directly.


**Modern approach:**

```css
.header-wrap {
  container-type: scroll-state;
}

@container scroll-state(stuck: top) {
  .header {
    box-shadow: 0 2px 8px rgba(0,0,0,.1);
    backdrop-filter: blur(12px);
  }
}
```

**Old approach:**

```css
/* JS scroll listener approach */
const header = document
 .querySelector('.header');
const offset = header
 .offsetTop;

window.addEventListener(
 'scroll', () => {
   header.classList
     .toggle('stuck',
     window.scrollY
       >= offset);
 }
);
```


**Browser support:** Limited availability · 50% global usage

Browsers: Chrome 135+, Edge 135+

[View on caniuse.com →](https://caniuse.com/css-scroll-state-queries) · [View on webstatus.dev →](https://webstatus.dev/features/container-scroll-state-queries) · [Learn more about Baseline →](https://web.dev/blog/announcing-baseline-in-action)


**Why the modern way wins:**

- **No scroll listeners** -- The browser tracks stuck and snapped states internally. No scroll event handlers, no requestAnimationFrame, no jank.
- **Multiple states** -- Query stuck (top, bottom, left, right), snapped (x, y, inline, block), and overflowing states — all with pure CSS.
- **Container query model** -- Uses the familiar @container syntax. If you know container queries, you already know how to use scroll-state queries.


**At a glance:**

- **States:** stuck, snapped (Plus overflowing)
- **Old Approach:** JS scroll events (addEventListener)
- **Modern Approach:** scroll-state() (Container query)


**How it works:**

Sticky headers that add a shadow when stuck, or carousels that highlight the active slide — these patterns always required JavaScript. You'd listen to scroll events, calculate positions, and toggle classes. This causes layout thrashing, jank, and race conditions.

`scroll-state()` container queries let CSS detect scroll-related states natively. Set `container-type: scroll-state` on the scrolling ancestor, then query it: `@container scroll-state(stuck: top)` matches when a child is stuck to the top. `@container scroll-state(snapped: x)` matches the currently snapped element. The browser handles all the tracking with zero JavaScript.



---

### Category: Color

### Color variants without Sass functions

*Color · Advanced*

The old way used Sass functions like lighten(), darken(), and saturate() at compile time. Relative color syntax derives variants from a variable at runtime with oklch(from var(--x) ...).


**Modern approach:**

```css
.btn {
  background: oklch(from var(--brand) calc(l + 0.2) c h);
}
```

**Old approach:**

```css
/* Sass: @use 'sass:color'; */
/* .btn { background: color.adjust($brand, $lightness: 20%); } */

.btn {
 background: lighten(var(--brand), 20%);
}

/* Compile-time only; no runtime change without rebuild. */
```


**Browser support:** Newly available · Since 2024 · 87% global usage

Browsers: Chrome 119+, Firefox 128+, Safari 16.4+, Edge 119+

[View on caniuse.com →](https://caniuse.com/css-relative-colors) · [View on MDN →](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_colors/Relative_colors) · [View on webstatus.dev →](https://webstatus.dev/features/relative-color) · [Learn more about Baseline →](https://web.dev/blog/announcing-baseline-in-action)


**Why the modern way wins:**

- **Runtime** -- Variants are computed from CSS variables when the style is applied. Change --brand and all derivatives update.
- **No preprocessor** -- No Sass or build step. Pure CSS, works with any pipeline and in browser devtools.
- **Full control** -- Adjust lightness (l), chroma (c), or hue (h) in oklch. Same idea as lighten/darken but with a proper color model.


**At a glance:**

- **Lines Saved:** 8+ → 5 (No Sass build)
- **Old Approach:** Sass functions (lighten(), darken(), compile-time)
- **Modern Approach:** Relative color syntax (oklch(from var(...) ...), runtime)


**How it works:**

The old way was Sass (or similar): `lighten($brand, 20%)`, `darken($brand, 10%)`, `saturate($brand, 5%)`. Those run at compile time and output static hex or rgb. If --brand changes at runtime (e.g. theme switch), you need to precompute every variant and output separate values.

The modern way is relative color syntax. You write something like `oklch(from var(--brand) calc(l + 0.2) c h)`: take the value of `var(--brand)`, interpret it in oklch, and create a new color with lightness increased by 0.2 and chroma and hue unchanged. It runs in the browser. Change --brand and the variant updates. No preprocessor required.


### Dark mode colors without duplicating values

*Color · Intermediate*

You defined every variable in :root and again inside @media (prefers-color-scheme: dark). light-dark() holds both values in one place so you do not repeat yourself.


**Modern approach:**

```css
:root {
  color-scheme: light dark;
  color: light-dark(#111, #eee);
}
```

**Old approach:**

```css
:root {
 --text: #111;
 --bg: #fff;
}

@media (prefers-color-scheme: dark) {
:root {
 --text: #eee;
 --bg: #222;
}
}
/* Every variable declared twice */
```


**Browser support:** Newly available · Since 2024 · 83% global usage

Browsers: Chrome 123+, Firefox 120+, Safari 17.5+, Edge 123+

[View on caniuse.com →](https://caniuse.com/mdn-css_types_color_light-dark) · [View on MDN →](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/light-dark) · [View on webstatus.dev →](https://webstatus.dev/features/light-dark) · [Learn more about Baseline →](https://web.dev/blog/announcing-baseline-in-action)


**Why the modern way wins:**

- **No duplication** -- First argument is light, second is dark. One declaration, no @media block for each variable.
- **Works with variables** -- light-dark(var(--text-light), var(--text-dark)) fits right into a design token setup.
- **Any property** -- Use it for color, background, border-color, fill, stroke. Anything that takes a color.


**At a glance:**

- **Lines Saved:** 12+ → 4 (No duplicate @media variables)
- **Old Approach:** :root + dark @media (Re-declare every variable for dark)
- **Modern Approach:** light-dark() (One value per scheme)


**How it works:**

The old approach was to set your colors (or CSS variables) in :root, then open a `@media (prefers-color-scheme: dark)` block and redeclare every variable or property for dark mode. That meant every color in two places and easy drift between light and dark.

The modern approach is `light-dark(lightValue, darkValue)`. The browser picks the first value in light mode and the second in dark mode, based on `prefers-color-scheme`. Pair it with `color-scheme: light dark` so form controls and scrollbars follow. You can use raw colors or variables: `light-dark(var(--text), var(--text-dark))`.


### Frosted glass effect without opacity hacks

*Color · Intermediate*

Frosted glass used to require a blurred copy of the background behind the element: a pseudo-element with the same background image, a filter: blur, and z-index stacking. backdrop-filter applies effects directly to whatever is rendered behind the element.


**Modern approach:**

```css
.glass {
  backdrop-filter: blur(12px) saturate(1.5);
  background: rgba(255, 255, 255, 0.1);
}
```

**Old approach:**

```css
/* blur the background with a positioned copy */
.card::before {
 content: ''; position: absolute; inset: 0;
 background-image: url(bg.jpg);
 background-size: cover;
 filter: blur(12px);
 z-index: -1;
}
```


**Browser support:** Widely available · Since 2022 · 96% global usage

Browsers: Chrome 76+, Firefox 103+, Safari 15.4+, Edge 79+

[View on caniuse.com →](https://caniuse.com/css-backdrop-filter) · [View on MDN →](https://developer.mozilla.org/en-US/docs/Web/CSS/backdrop-filter) · [View on webstatus.dev →](https://webstatus.dev/features/backdrop-filter) · [Learn more about Baseline →](https://web.dev/blog/announcing-baseline-in-action)


**Why the modern way wins:**

- **Real blur** -- The blur applies to whatever is rendered behind the element, including other elements. Not just a static background image copy.
- **Stacks filters** -- Combine blur, brightness, contrast, saturate, and grayscale in a single declaration.
- **No extra elements** -- No ::before pseudo-element with a positioned blurred background duplicate. One property on the element.


**At a glance:**

- **Lines Saved:** 10 → 4 (No background copy trick)
- **Old Approach:** ::before + filter (Positioned background image duplicate)
- **Modern Approach:** backdrop-filter (Blur whatever is behind the element)


**How it works:**

Frosted glass required duplicating the background behind the card: a `::before` pseudo-element positioned absolutely with the same background image, a `filter: blur()` applied, and careful z-index stacking. It only worked with a known static background and broke with scrolling or dynamic content behind it.

`backdrop-filter` applies filter effects to the area behind the element in the stacking context. It blurs, desaturates, or brightens whatever is rendered behind it — including other elements, not just the page background. Pair it with a semi-transparent `background` to let the blurred content show through.


### Perceptually uniform colors with oklch

*Color · Intermediate*

HSL looks like it should be perceptually uniform, but it isn't. Yellow at hsl(60 100% 50%) appears far brighter than blue at hsl(240 100% 50%) at the same lightness. oklch uses a model where L actually means the same perceived brightness across all hues.


**Modern approach:**

```css
--brand:       oklch(0.55 0.2 264);
--brand-light: oklch(0.75 0.2 264);
--brand-dark:  oklch(0.35 0.2 264);
```

**Old approach:**

```css
/* HSL: same L value, different perceived brightness */
--yellow: hsl(60 100% 50%);  /* blinding */
--blue:   hsl(240 100% 50%); /* dark */
/* manually tweak each shade to look balanced */
--brand-light: hsl(246 87% 68%);
```


**Browser support:** Widely available · Since 2023 · 90% global usage

Browsers: Chrome 111+, Firefox 113+, Safari 15.4+, Edge 111+

[View on caniuse.com →](https://caniuse.com/css-oklch) · [View on MDN →](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/oklch) · [View on webstatus.dev →](https://webstatus.dev/features/oklch) · [Learn more about Baseline →](https://web.dev/blog/announcing-baseline-in-action)


**Why the modern way wins:**

- **Predictable lightness** -- L: 0.5 looks the same perceived brightness in oklch regardless of the hue. That's not true in HSL.
- **Easy palette generation** -- Change only L for lighter or darker shades. Change only H to shift hue. Change only C for saturation. They're independent.
- **Wide gamut ready** -- oklch can express P3 colors that hex and sRGB can't. On wide-gamut displays the chroma can go higher than sRGB allows.


**At a glance:**

- **Old Approach:** Hex / HSL (Guess-and-check each shade)
- **Modern Approach:** oklch() (Adjust L, C, H independently)
- **Color model:** L · C · H (Lightness · Chroma · Hue)


**How it works:**

HSL was supposed to be human-friendly but its lightness channel is not perceptually uniform. Yellow at `hsl(60 100% 50%)` looks far brighter than blue at `hsl(240 100% 50%)` even though both have L: 50%. Building a consistent color palette means manually adjusting each shade by eye until it looks balanced.

`oklch(L C H)` uses a perceptually uniform lightness model. L: 0.55 looks the same perceived brightness whether the hue is green, orange, or purple. To create a lighter shade, increase L. To shift hue, change H. Chroma C controls saturation. All three values are genuinely independent in a way HSL's S and L are not.


### Styling form controls without rebuilding them

*Color · Beginner*

The old way was appearance: none plus dozens of lines to rebuild the control. accent-color changes the native control color in one property.


**Modern approach:**

```css
input[type="checkbox"],
input[type="radio"] {
  accent-color: #7c3aed;
}
```

**Old approach:**

```css
input[type="checkbox"] {
 appearance: none;
 width: 1.25rem; height: 1.25rem;
 border: 2px solid ...;
 background: ...; border-radius: ...;
 /* + :checked state, focus, etc. */
}
```


**Browser support:** Widely available · Since 2022 · 93% global usage

Browsers: Chrome 93+, Firefox 92+, Safari 15.4+, Edge 93+

[View on caniuse.com →](https://caniuse.com/mdn-css_properties_accent-color) · [View on MDN →](https://developer.mozilla.org/en-US/docs/Web/CSS/accent-color) · [View on webstatus.dev →](https://webstatus.dev/features/accent-color) · [Learn more about Baseline →](https://web.dev/blog/announcing-baseline-in-action)


**Why the modern way wins:**

- **One property** -- Set the accent color. Checkboxes, radios, range, and progress use it. No rebuild.
- **Native behavior kept** -- Focus, keyboard, and screen reader behavior stay intact. You only change the color.
- **Theme friendly** -- Use a custom property. Dark mode or theme switch updates controls automatically.


**At a glance:**

- **Lines Saved:** 20+ → 3 (85%+ less code)
- **Old Approach:** appearance: none (Rebuild from scratch)
- **Modern Approach:** accent-color (Native control, one property)


**How it works:**

To style checkboxes and radios you used to set `appearance: none` and then rebuild the control with width, height, border, background, border-radius, and :checked states. Dozens of lines and you had to handle focus and accessibility yourself.

`accent-color` tells the browser which color to use for the control's accent (check mark, radio dot, range thumb). The control stays native, so focus and keyboard behavior are unchanged. One line, theme-aware if you use a variable.


### Vivid colors beyond sRGB

*Color · Intermediate*

The old way was hex, rgb(), or hsl(), all stuck in sRGB. On P3 or other wide-gamut screens, those colors look flat. oklch and color(display-p3 ...) unlock the extra range.


**Modern approach:**

```css
.hero {
  color: oklch(0.7 0.25 29);
}
```

**Old approach:**

```css
.hero {
 color: #c85032;
}

/* Hex, rgb(), hsl() are sRGB. Limited on wide-gamut screens. */
```


**Browser support:** Newly available · Since 2023 · 90% global usage

Browsers: Chrome 111+, Firefox 113+, Safari 15.4+, Edge 111+

[View on caniuse.com →](https://caniuse.com/mdn-css_types_color_oklch) · [View on MDN →](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/oklch) · [View on webstatus.dev →](https://webstatus.dev/features/color-function) · [Learn more about Baseline →](https://web.dev/blog/announcing-baseline-in-action)


**Why the modern way wins:**

- **Wide gamut** -- oklch and display-p3 can use colors outside sRGB. On P3 displays, oranges and greens really pop.
- **Predictable** -- oklch is perceptually uniform. Tweaking lightness or chroma feels consistent; no weird HSL surprises.
- **Future-proof** -- Browsers map out-of-gamut to the display. Same code works on sRGB and P3; P3 gets the extra range where available.


**At a glance:**

- **Lines Saved:** 4 → 5 (Same size, better colors)
- **Old Approach:** sRGB only (Hex, rgb(), hsl())
- **Modern Approach:** oklch / display-p3 (Wide gamut, vivid on P3)


**How it works:**

The old way: every color you set with hex, `rgb()`, or `hsl()` lives in the sRGB gamut. On phones and laptops with P3 or other wide-gamut displays, the screen can show more saturated reds, greens, and oranges, but the browser was only given sRGB values, so things look a bit washed out.

The modern way: use `oklch(0.7 0.25 29)` for a perceptually uniform color that can go beyond sRGB when the display allows it, or `color(display-p3 1 0.2 0.1)` to target the P3 gamut directly. Browsers that support it will show the extra range; others will clamp to what they can show. You get richer color where it matters, without breaking older screens.



---

### Category: Colors

### Mixing colors without a preprocessor

*Colors · Intermediate*

Blending two colors used to require Sass, Less, or a JS utility. color-mix() does it in plain CSS, and it supports perceptually uniform color spaces like oklch.


**Modern approach:**

```css
.card {
  background: color-mix(in oklch, #3b82f6 60%, #ec4899);
}
```

**Old approach:**

```css
// _variables.scss
$blue: #3b82f6;
$pink: #ec4899;

$blend: mix($blue, $pink, 60%);

.card {
 background: $blend;
}
// Compiles at build time. Static.
```


**Browser support:** Newly available · Since 2023 · 89% global usage

Browsers: Chrome 111+, Firefox 113+, Safari 16.2+, Edge 111+

[View on caniuse.com →](https://caniuse.com/mdn-css_types_color_color-mix) · [View on MDN →](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/color-mix) · [View on webstatus.dev →](https://webstatus.dev/features/color-mix) · [Learn more about Baseline →](https://web.dev/blog/announcing-baseline-in-action)


**Why the modern way wins:**

- **Perceptually uniform** -- Mix in oklch for results that look natural to the human eye, unlike Sass's sRGB mixing.
- **Dynamic at runtime** -- Change the mix with custom properties, no recompilation. Works with themes, dark mode, anything.
- **No build step** -- Drop Sass, PostCSS, or any preprocessor for color manipulation. Native CSS does it now.


**At a glance:**

- **Dependency Removed:** Sass (No more mix() import)
- **Old Approach:** Build-time (Static, compiled output)
- **Modern Approach:** Runtime (Dynamic, themeable)


**How it works:**

`color-mix(in oklch, color1 percentage, color2)` blends two colors in the specified color space. The percentage controls how much of the first color to use.

The `oklch` color space is perceptually uniform, meaning a 50/50 mix of blue and yellow actually looks like a midpoint, unlike sRGB mixing which often produces muddy results. You can also use `srgb`, `hsl`, `lab`, or `lch`.

The best part: combine it with custom properties for dynamic theming. `color-mix(in oklch, var(--brand) 80%, white)` gives you a lighter variant of any brand color, at runtime, no build step.



---

### Category: Selector

### Focus styles without annoying mouse users

*Selector · Beginner*

:focus shows an outline on every click, which looks wrong for mouse users. :focus-visible shows it only when the browser expects keyboard focus.


**Modern approach:**

```css
button:focus-visible {
  outline: 2px solid var(--focus-color);
}
```

**Old approach:**

```css
button:focus {
 outline: 2px solid blue;
}
// Outline appears on mouse click. Often removed with outline: none.
```


**Browser support:** Widely available · Since 2022 · 95% global usage

Browsers: Chrome 86+, Firefox 85+, Safari 15.4+, Edge 86+

[View on caniuse.com →](https://caniuse.com/css-focus-visible) · [View on MDN →](https://developer.mozilla.org/en-US/docs/Web/CSS/:focus-visible) · [View on webstatus.dev →](https://webstatus.dev/features/focus-visible) · [Learn more about Baseline →](https://web.dev/blog/announcing-baseline-in-action)


**Why the modern way wins:**

- **Keyboard only** -- Outline shows when focus comes from Tab, not from a mouse click. Matches user intent.
- **Accessible by default** -- You keep visible focus for keyboard users. No need to remove outline and hurt a11y.
- **Browser decides** -- Browsers use heuristics (keyboard vs pointer). One selector, correct behavior.


**At a glance:**

- **Lines Saved:** Same (Better behavior)
- **Old Approach:** :focus everywhere (Outline on mouse click)
- **Modern Approach:** :focus-visible (Outline when keyboard focusing)


**How it works:**

With `:focus`, the outline appears whenever the element gets focus, including after a mouse click. That looks odd and many sites removed it with `outline: none`, which hurts keyboard users.

`:focus-visible` only matches when the browser would normally show a focus ring, e.g. after Tab. Mouse users don't see it, keyboard users do. You get clear focus styles without the old tradeoff.


### Form validation styles without JavaScript

*Selector · Beginner*

:invalid fires as soon as the page loads, marking empty required fields as errors before anyone types. The workaround was JS adding a .touched class after blur. :user-invalid only activates after the user has interacted with the field.


**Modern approach:**

```css
input:user-invalid {
  border-color: red;
}
input:user-valid {
  border-color: green;
}
```

**Old approach:**

```css
/* only style after .touched class is added by JS */
input.touched:invalid { border-color: red; }
input.touched:valid { border-color: green; }
// JS: add .touched class on blur
input.addEventListener('blur', () => {
 input.classList.add('touched');
});
```


**Browser support:** Newly available · Since 2023 · 85% global usage

Browsers: Chrome 119+, Firefox 88+, Safari 16.5+, Edge 119+

[View on caniuse.com →](https://caniuse.com/mdn-css_selectors_user-invalid) · [View on MDN →](https://developer.mozilla.org/en-US/docs/Web/CSS/:user-invalid) · [View on webstatus.dev →](https://webstatus.dev/features/user-valid-user-invalid) · [Learn more about Baseline →](https://web.dev/blog/announcing-baseline-in-action)


**Why the modern way wins:**

- **No blur listener** -- No JavaScript event listener, no .touched class, no class toggling on every field.
- **Interaction-aware** -- :user-invalid only triggers after the user has interacted with the field. Empty required fields stay neutral on page load.
- **Pairs with :user-valid** -- :user-valid shows success state the same way. Both follow the same interaction threshold as :user-invalid.


**At a glance:**

- **Lines Saved:** 10 → 4 (No JS touched class)
- **Old Approach:** .touched + JS blur (Class toggle on every field)
- **Modern Approach:** :user-invalid (Browser tracks interaction state)


**How it works:**

:invalid applies the moment the page loads. A required empty field is immediately styled as an error before the user touches it. The fix was JavaScript: listen for blur on each input, add a .touched class, then use .touched:invalid in CSS to defer the error styling until after first interaction.

`:user-invalid` and `:user-valid` are built-in pseudo-classes that match after the user has interacted with a field. :user-invalid activates when the field is left in an invalid state. :user-valid activates on a valid state. The browser tracks the interaction threshold — no JavaScript, no class management.


### Grouping selectors without repetition

*Selector · Beginner*

Repeating .card h1, .card h2, .card h3 is verbose. :is(h1, h2, h3, h4) under .card does the same in one rule.


**Modern approach:**

```css
.card :is(h1, h2, h3, h4) {
  margin-bottom: 0.5em;
}
```

**Old approach:**

```css
.card h1, .card h2, .card h3, .card h4 {
 margin-bottom: 0.5em;
}
// Same prefix repeated for every selector
```


**Browser support:** Widely available · Since 2021 · 96% global usage

Browsers: Chrome 88+, Firefox 78+, Safari 14+, Edge 88+

[View on caniuse.com →](https://caniuse.com/css-matches-pseudo) · [View on MDN →](https://developer.mozilla.org/en-US/docs/Web/CSS/:is) · [View on webstatus.dev →](https://webstatus.dev/features/is) · [Learn more about Baseline →](https://web.dev/blog/announcing-baseline-in-action)


**Why the modern way wins:**

- **No repetition** -- Write the shared part once. Add or remove items in the list without duplicating the prefix.
- **Easier to read** -- Intent is clear: these headings inside .card get the same style.
- **Takes specificity of argument** -- :is() uses the highest specificity in its list. Good to know when overriding.


**At a glance:**

- **Lines Saved:** 6 → 3 (50% less code)
- **Old Approach:** Repeated selectors (.card h1, .card h2, ...)
- **Modern Approach:** :is() group (One prefix, list of targets)


**How it works:**

The old way was to list every combination: .card h1, .card h2, .card h3, .card h4. Same prefix over and over. Adding h5 meant another comma and another .card h5.

`.card :is(h1, h2, h3, h4)` means .card plus any one of those. One prefix, one list. Change the list without touching the rest. :is() also keeps specificity predictable (the most specific selector in the list wins).


### Low-specificity resets without complicated selectors

*Selector · Intermediate*

Resets used verbose low-specificity tricks, or you fought them later with higher specificity. :where() has zero specificity so it never wins over your component styles.


**Modern approach:**

```css
:where(ul, ol) {
  margin: 0;
  padding-inline-start: 1.5rem;
}
```

**Old approach:**

```css
ul, ol {
 margin: 0;
 padding-left: 1.5rem;
}
/* Specificity (0,0,2). Component .list { padding: 0 } loses. */
```


**Browser support:** Widely available · Since 2021 · 96% global usage

Browsers: Chrome 88+, Firefox 78+, Safari 14+, Edge 88+

[View on caniuse.com →](https://caniuse.com/css-matches-pseudo) · [View on MDN →](https://developer.mozilla.org/en-US/docs/Web/CSS/:where) · [View on webstatus.dev →](https://webstatus.dev/features/where) · [Learn more about Baseline →](https://web.dev/blog/announcing-baseline-in-action)


**Why the modern way wins:**

- **Zero specificity** -- :where() strips specificity from its argument. Your reset never overrides component styles.
- **No !important** -- No need to bump specificity or use !important in components to beat the reset.
- **Same syntax as :is()** -- Drop in :where() where you would use :is(). Same selector list, zero specificity.


**At a glance:**

- **Specificity:** 0 (Resets never win over components)
- **Old Approach:** Tag selectors or .reset (Fight specificity later)
- **Modern Approach:** :where() (Zero specificity resets)


**How it works:**

The old approach was either very specific selectors for resets (so they applied) or low-specificity hacks that were still hard to override. Tag selectors like `ul, ol` have specificity (0,0,2). A single class on a list like `.list` has (0,1,0), so it wins, but if your reset used a class or multiple elements, you often had to add more specificity or !important in components.

`:where(ul, ol)` accepts the same selector list as `:is()`, but the whole thing gets zero specificity. So your reset applies by order in the cascade, but any single class or ID in a component beats it. Use :where() for resets, base styles, and defaults you want to be easy to override.


### Scroll spy without IntersectionObserver

*Selector · Intermediate*

Highlighting navigation links based on scroll position used to require JavaScript IntersectionObserver or scroll event listeners. Now CSS can track which section is in view with scroll-target-group and the :target-current pseudo-class.


**Modern approach:**

```css
.scroller {
  overflow-y: auto;
}

nav a:target-current {
  color: var(--accent);
}
```

**Old approach:**

```css
/* JS IntersectionObserver approach */
const observer = new IntersectionObserver(
 (entries) => {
   entries.forEach(entry => {
     const link = document
       .querySelector(`a[href="#
       ${entry.target.id}"]`);
     link.classList.toggle(
       'active',
       entry.isIntersecting);
   });
 },
 { threshold: 0.5 }
);

document.querySelectorAll('section')
 .forEach(s =>
   observer.observe(s));
```


**Browser support:** Limited availability · 48% global usage

Browsers: Chrome 135+, Edge 135+

[View on caniuse.com →](https://caniuse.com/css-scroll-state-queries) · [View on webstatus.dev →](https://webstatus.dev/features/scroll-marker-targets) · [Learn more about Baseline →](https://web.dev/blog/announcing-baseline-in-action)


**Why the modern way wins:**

- **Zero JavaScript** -- No IntersectionObserver, no scroll event listeners, no class toggling. The browser tracks which section is in view natively.
- **Always in sync** -- The :target-current pseudo-class updates in real-time as the user scrolls. No timing bugs or threshold tuning.
- **Works with CSS scroll-snap** -- Pairs naturally with scroll-snap for section-based layouts. The active indicator follows snap points automatically.


**At a glance:**

- **Lines Saved:** 18 → 6 (No JS required)
- **Old Approach:** IntersectionObserver (JS scroll tracking)
- **Modern Approach:** :target-current (CSS pseudo-class)


**How it works:**

Scroll spy navigation — highlighting the current section's link as the user scrolls — has always required JavaScript. The typical approach uses IntersectionObserver to watch each section, then toggles an 'active' class on the corresponding nav link. This works but requires careful threshold tuning, cleanup on unmount, and can fall out of sync with fast scrolling.

The CSS approach uses `:target-current`, a pseudo-class that matches anchor links pointing to the element currently in the scroll port. Combined with smooth scrolling and scroll-snap, you get a complete scroll-spy navigation with no JavaScript at all. The browser handles the tracking natively, so it's always perfectly in sync.



---

### Category: Selectors

### Selecting parent elements without JavaScript

*Selectors · Intermediate*

Selecting a parent based on its children used to require JavaScript. :has() handles it in pure CSS, no event listeners needed.


**Modern approach:**

```css
.form-group:has(input:invalid) {
  border-color: red;
  background: #fff0f0;
}
```

**Old approach:**

```css
// Watch for changes, find parent
document.querySelectorAll('input')
 .forEach(input => {
   input.addEventListener('invalid', () => {
     input.closest('.form-group')
       .classList.add('has-error');
   });
 });
```


**Browser support:** Newly available · Since 2023 · 94% global usage

Browsers: Chrome 105+, Firefox 121+, Safari 15.4+, Edge 105+

[View on caniuse.com →](https://caniuse.com/css-has) · [View on MDN →](https://developer.mozilla.org/en-US/docs/Web/CSS/:has) · [View on webstatus.dev →](https://webstatus.dev/features/has) · [Learn more about Baseline →](https://web.dev/blog/announcing-baseline-in-action)


**Why the modern way wins:**

- **No JavaScript needed** -- Eliminates an entire class of DOM-manipulation code. Fewer event listeners, fewer bugs.
- **Instant response** -- Browser applies styles in the rendering pipeline, no waiting for JS execution or reflow.
- **Composes naturally** -- Chain with other selectors: .nav:has(.dropdown:hover) , body:has(dialog[open]) .


**At a glance:**

- **Lines Saved:** 8 → 3 (JS → pure CSS)
- **Old Approach:** JavaScript (Event listeners + DOM)
- **Modern Approach:** Pure CSS (Zero runtime cost)


**How it works:**

`:has()` is a relational pseudo-class. When you write `.card:has(img)`, it selects any `.card` that contains an `img` as a descendant. It's the parent selector that CSS lacked for 25 years.

You can use any selector inside `:has()`: pseudo-classes like `:invalid`, `:checked`, `:hover`, or even combinators like `:has(> .direct-child)`. It unlocks conditional styling that previously required JavaScript.



---

### Category: Typography

### Balanced headlines without manual line breaks

*Typography · Beginner*

You used to add br tags by hand or pull in Balance-Text.js. Now one property evens out lines so headlines don't end with a single word.


**Modern approach:**

```css
h1, h2 {
  text-wrap: balance;
  max-width: 40ch;
}
```

**Old approach:**

```css
/* HTML: manual <br> or wrapper for JS */
h1 {
 text-align: center;
 max-width: 40ch;
 /* Balance-Text.js: script + init */
 /* or insert <br> in CMS/HTML */
}
```


**Browser support:** Newly available · Since 2023 · 87% global usage

Browsers: Chrome 114+, Firefox 121+, Safari 17.4+, Edge 114+

[View on caniuse.com →](https://caniuse.com/css-text-wrap-balance) · [View on MDN →](https://developer.mozilla.org/en-US/docs/Web/CSS/text-wrap) · [Polyfill available →](https://github.com/adobe/balance-text) · [View on webstatus.dev →](https://webstatus.dev/features/text-wrap-balance) · [Learn more about Baseline →](https://web.dev/blog/announcing-baseline-in-action)


**Why the modern way wins:**

- **No scripts** -- Drop Balance-Text or any JS. The browser balances lines natively.
- **No manual br tags** -- Works with any content width. No CMS hacks or hand-placed line breaks.
- **Performance** -- Layout happens in the engine. No DOM reads or resize observers.


**At a glance:**

- **Lines Saved:** 7 → 4 (No JS, no br)
- **Old Approach:** Manual br or JS lib (Balance-Text, CMS hacks)
- **Modern Approach:** One property (Native text-wrap: balance)


**How it works:**

Headlines often wrapped with one word on the last line. The old fix was either manual `<br>` tags (brittle when copy changes) or a script like Balance-Text that measured and reflowed after paint.

`text-wrap: balance` tells the browser to prefer more even line lengths. It works best on short blocks (a few lines). No script, no DOM access, just layout.


### Drop caps without float hacks

*Typography · Beginner*

The old way used float, a large font-size, and manual line-height and margin, and it broke across browsers. initial-letter gives you a real drop cap in one property.


**Modern approach:**

```css
.drop-cap::first-letter {
  initial-letter: 3;
}
```

**Old approach:**

```css
.drop-cap::first-letter {
 float: left;
 font-size: 3em;
 line-height: 1;
 margin-right: 8px;
}

/* Line wrapping and alignment often broke. */
```


**Browser support:** Newly available · Since 2024 · 91% global usage

Browsers: Chrome 110+, Firefox 130+, Safari 9+, Edge 110+

[View on caniuse.com →](https://caniuse.com/css-initial-letter) · [View on MDN →](https://developer.mozilla.org/en-US/docs/Web/CSS/initial-letter) · [View on webstatus.dev →](https://webstatus.dev/features/initial-letter) · [Learn more about Baseline →](https://web.dev/blog/announcing-baseline-in-action)


**Why the modern way wins:**

- **One property** -- No float, no guessing font-size or line-height. You say how many lines the letter sinks and the browser does the rest.
- **Stable layout** -- Initial-letter is designed for drop caps. Wrapping and alignment stay consistent across browsers.
- **Optional raise** -- initial-letter: 3 2 means sink 3 lines and raise 2. You get control without fragile hacks.


**At a glance:**

- **Lines Saved:** 8 → 4 (50% less code)
- **Old Approach:** Float + font-size (Line-height and margin tweaks)
- **Modern Approach:** initial-letter (One property, proper drop cap)


**How it works:**

The old way: style `::first-letter` with `float: left`, a big `font-size` (e.g. 3em), `line-height: 1`, and `margin-right` to clear the text. It kind of worked but line wrapping and alignment varied by browser and font, and you had to tweak by eye.

The modern way: set `initial-letter: 3` (or another number). The number is how many lines the letter sinks into. The browser sizes and positions it correctly. You can use two values, e.g. `3 2`, for sink and raise. One property, predictable result.


### Fluid typography without media queries

*Typography · Intermediate*

The old way used several media queries with different font-sizes. clamp() scales smoothly between a min and max.


**Modern approach:**

```css
h1 {
  font-size: clamp(1rem, 2.5vw, 2rem);
}
```

**Old approach:**

```css
h1 {
 font-size: 1rem;
}

@media (min-width: 600px) {
 h1 { font-size: 1.5rem; }
}
@media (min-width: 900px) {
 h1 { font-size: 2rem; }
}
```


**Browser support:** Widely available · Since 2021 · 95% global usage

Browsers: Chrome 79+, Firefox 75+, Safari 13.1+, Edge 79+

[View on caniuse.com →](https://caniuse.com/css-math-functions) · [View on MDN →](https://developer.mozilla.org/en-US/docs/Web/CSS/clamp) · [View on webstatus.dev →](https://webstatus.dev/features/min-max-clamp) · [Learn more about Baseline →](https://web.dev/blog/announcing-baseline-in-action)


**Why the modern way wins:**

- **No breakpoint ladder** -- One declaration. Size scales with viewport instead of jumping at breakpoints.
- **Smooth scaling** -- clamp(min, preferred, max) keeps size between bounds. No sudden jumps.
- **Any unit** -- Use rem, em, vw, or a mix. Same pattern for line-height or spacing.


**At a glance:**

- **Lines Saved:** 10 → 2 (80% less code)
- **Old Approach:** Multiple @media (Stepwise font sizes)
- **Modern Approach:** One clamp() (Fluid between min and max)


**How it works:**

The old approach was a base font-size plus several media queries: at 600px switch to 1.5rem, at 900px to 2rem, and so on. Size jumped at each breakpoint and you had to maintain the ladder.

`clamp(1rem, 2.5vw, 2rem)` means: never smaller than 1rem, never larger than 2rem, and in between use 2.5vw. One rule, smooth scaling, no media queries.


### Font loading without invisible text

*Typography · Beginner*

Custom fonts used to cause a flash of invisible text (FOIT) while they downloaded. font-display: swap shows the fallback right away, then swaps when the font is ready.


**Modern approach:**

```css
@font-face {
  font-family: "MyFont";
  src: url("MyFont.woff2");
  font-display: swap;
}
```

**Old approach:**

```css
@font-face {
 font-family: "MyFont";
 src: url("MyFont.woff2");
}
/* No font-display: text invisible until load (FOIT) */
```


**Browser support:** Widely available · Since 2019 · 96% global usage

Browsers: Chrome 60+, Firefox 58+, Safari 11.1+, Edge 79+

[View on caniuse.com →](https://caniuse.com/css-font-rendering-controls) · [View on MDN →](https://developer.mozilla.org/en-US/docs/Web/CSS/@font-face/font-display) · [View on webstatus.dev →](https://webstatus.dev/features/font-display) · [Learn more about Baseline →](https://web.dev/blog/announcing-baseline-in-action)


**Why the modern way wins:**

- **No FOIT** -- Users see fallback text right away instead of blank space while the font downloads.
- **One line** -- Add font-display: swap to your existing @font-face. No JS or loading strategy needed.
- **Other options** -- optional hides text if font is not cached; block gives a short invisible timeout. swap is the safe default.


**At a glance:**

- **Behavior:** Swap (Fallback first, then custom font)
- **Old Approach:** Default (block) (Invisible text until load)
- **Modern Approach:** font-display: swap (Text visible immediately)


**How it works:**

Without `font-display`, the browser uses a default behavior that often hides text for a few seconds while the custom font loads. That is the flash of invisible text (FOIT). Users on slow connections see a blank area until the font file arrives.

Adding `font-display: swap` to your @font-face tells the browser to show the fallback font immediately and swap to the custom font when it is ready. Users can read right away; they may see a brief reflow when the font loads, but that is usually better than invisible text. Use it on every @font-face unless you have a reason to use `optional` or `block`.


### Multiline text truncation without JavaScript

*Typography · Beginner*

The old way was JS that counted characters or words and appended "...", or the -webkit-line-clamp plus -webkit-box-orient combo. line-clamp is now in the spec and gives you clean multiline truncation.


**Modern approach:**

```css
.card-title {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  overflow: hidden;
}
```

**Old approach:**

```css
/* JS: const max = 120; el.textContent = text.slice(0, max) + '...';
  or word count, or measure with getComputedStyle. Breaks on resize. */

.card-title {
 overflow: hidden;
 text-overflow: ellipsis;
}

/* Or: -webkit-box + -webkit-line-clamp + -webkit-box-orient: vertical */
```


**Browser support:** Widely available · Since 2021 · 96% global usage

Browsers: Chrome 14+, Firefox 68+, Safari 5+, Edge 17+

[View on caniuse.com →](https://caniuse.com/css-line-clamp) · [View on MDN →](https://developer.mozilla.org/en-US/docs/Web/CSS/-webkit-line-clamp) · [View on webstatus.dev →](https://webstatus.dev/features/line-clamp) · [Learn more about Baseline →](https://web.dev/blog/announcing-baseline-in-action)


**Why the modern way wins:**

- **No character math** -- You choose the line count. The browser adds the ellipsis. No JS, no slicing, no resize listeners.
- **Spec-backed** -- line-clamp is in the CSS spec. You keep -webkit-line-clamp for support; same value, future-proof.
- **Layout-based** -- Truncation is by lines, not characters. Works with any font size and container width.


**At a glance:**

- **Lines Saved:** 10+ → 7 (No JS truncation)
- **Old Approach:** JS or -webkit-box-orient (Char count or legacy hack)
- **Modern Approach:** line-clamp (Standard property, -webkit- for support)


**How it works:**

The old way was either JavaScript that cut the string at a character or word limit and appended "..." (and often broke on resize or different font sizes), or the CSS hack: `display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical`. The latter worked but relied on a non-standard property and had to be remembered as a set.

The modern way: the spec has `line-clamp`. You still use `display: -webkit-box` and `-webkit-line-clamp: 3` for broad support, and add `line-clamp: 3` so you're using the standard name. `overflow: hidden` does the rest. No JavaScript, truncation by line count, ellipsis by the browser.


### Multiple font weights without multiple files

*Typography · Intermediate*

You loaded a separate font file for each weight (400, 500, 600, 700), so 4 or more HTTP requests. One variable font file covers the full range with font-weight: 100 900.


**Modern approach:**

```css
@font-face {
  font-family: "MyVar";
  src: url("MyVar.woff2");
  font-weight: 100 900;
}
```

**Old approach:**

```css
@font-face {
 font-family: "MyFont";
 src: url("MyFont-Regular.woff2");
 font-weight: 400;
}
@font-face { font-weight: 700; ... }
@font-face { font-weight: 600; ... }
/* One request per weight */
```


**Browser support:** Widely available · Since 2018 · 96% global usage

Browsers: Chrome 66+, Firefox 62+, Safari 11+, Edge 17+

[View on caniuse.com →](https://caniuse.com/variable-fonts) · [View on MDN →](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_fonts/Variable_fonts_guide) · [View on webstatus.dev →](https://webstatus.dev/features/font-variation-settings) · [Learn more about Baseline →](https://web.dev/blog/announcing-baseline-in-action)


**Why the modern way wins:**

- **Fewer requests** -- One variable font file instead of four or more for Regular, Medium, SemiBold, Bold.
- **Any weight in range** -- Use font-weight: 350 or 627 if the font supports it. No need to add a new @font-face.
- **Smaller total size** -- One optimized file is often smaller than the sum of several static weight files.


**At a glance:**

- **Requests:** 4+ → 1 (One file for full range)
- **Old Approach:** One @font-face per weight (4+ HTTP requests)
- **Modern Approach:** Variable font (font-weight: 100 900)


**How it works:**

The old approach was one @font-face per weight: Regular (400), Medium (500), SemiBold (600), Bold (700). Each pointed at a different file, so the browser made 4 or more requests and you had to add a new @font-face whenever you needed another weight.

Variable fonts pack multiple weights (and sometimes width or other axes) into a single file. In @font-face you set `font-weight: 100 900` (or the range the font supports). The browser downloads one file and you use any weight in that range with `font-weight: 400`, `font-weight: 600`, etc. Check the font's documentation for its actual range.


### Vertical text centering without padding hacks

*Typography · Beginner*

Text always looked optically off-center because font metrics include extra space for ascenders and descenders. The text-box property trims that invisible space for true visual centering.


**Modern approach:**

```css
.btn {
  padding: 10px 20px;
  text-box: trim-both cap alphabetic;
}
```

**Old approach:**

```css
.btn {
 display: inline-flex;
 align-items: center;
 padding: 10px 20px;
 /* still looks off-center vertically */
 padding-top: 8px; /* manual tweak */
}
```


**Browser support:** Limited availability · 79% global usage

Browsers: Chrome 132+, Safari 17.4+, Edge 132+

[View on caniuse.com →](https://caniuse.com/css-text-box-trim) · [View on MDN →](https://developer.mozilla.org/en-US/docs/Web/CSS/text-box-trim) · [View on webstatus.dev →](https://webstatus.dev/features/text-box) · [Learn more about Baseline →](https://web.dev/blog/announcing-baseline-in-action)


**Why the modern way wins:**

- **True centering** -- Trims invisible font metric space above cap height and below alphabetic baseline. Math and optics finally agree.
- **Works everywhere** -- Buttons, badges, tags, headings, pills. Anywhere text looked subtly off-center now looks perfect.
- **Font-agnostic** -- The browser reads the font's actual metrics. Switching fonts doesn't break the centering.


**At a glance:**

- **Lines Saved:** 7 → 4 (No manual tweaks)
- **Old Approach:** Padding hacks (Uneven top/bottom padding)
- **Modern Approach:** text-box trim (trim-both cap alphabetic)


**How it works:**

Every font has internal metrics: ascent (space above for accents) and descent (space below for descenders like g and y). When you center text in a button or container, the browser centers the full content box including these invisible metrics. The visual center of the actual letters ends up slightly too low.

The `text-box` shorthand combines `text-box-trim` and `text-box-edge`. Using `trim-both` trims above and below, while `cap alphabetic` sets the trim edges to the cap height (top of capital letters) and alphabetic baseline. The result: the visible text is truly centered within its container, regardless of font or size.



---

### Category: Workflow

### Controlling specificity without !important

*Workflow · Intermediate*

The old way was stacking more specific selectors or throwing !important. @layer lets you decide order without fighting specificity.


**Modern approach:**

```css
@layer base, components, utilities;

@layer utilities {
  .mt-4 { margin-top: 1rem; }
}
```

**Old approach:**

```css
.card .title { font-size: 1rem; }
.page .card .title { font-size: 1.25rem; }
.page .card .title.special { color: red !important; }
// More specific selectors or !important to override
```


**Browser support:** Widely available · Since 2022 · 95% global usage

Browsers: Chrome 99+, Firefox 97+, Safari 15.4+, Edge 99+

[View on caniuse.com →](https://caniuse.com/css-cascade-layers) · [View on MDN →](https://developer.mozilla.org/en-US/docs/Web/CSS/@layer) · [View on webstatus.dev →](https://webstatus.dev/features/cascade-layers) · [Learn more about Baseline →](https://web.dev/blog/announcing-baseline-in-action)


**Why the modern way wins:**

- **Order over specificity** -- Later layers win. No need to make selectors more specific to override.
- **Predictable cascade** -- base, then components, then utilities. Same order every time.
- **No !important** -- Utilities can override components with a single class. Clean and explicit.


**At a glance:**

- **Lines Saved:** N/A (Clear structure)
- **Old Approach:** !important, specificity (Selector arms race)
- **Modern Approach:** @layer order (Declared priority)


**How it works:**

Previously you made selectors more specific (e.g. .page .card .title) or used !important to force overrides. That led to specificity wars and hard-to-debug styles.

`@layer base, components, utilities` defines the order. Whatever comes later wins when specificity is equal. Put resets in base, components in components, and utility classes in utilities. No !important, no long selectors.


### Dark mode defaults without extra CSS

*Workflow · Beginner*

You used to restyle every form control, scrollbar, and background for dark mode. color-scheme tells the browser to use its built-in light or dark styling for those parts.


**Modern approach:**

```css
:root {
  color-scheme: light dark;
}
```

**Old approach:**

```css
@media (prefers-color-scheme: dark) {
 input, select, textarea, button {
   background: #333;
   color: #eee;
 }
 ::-webkit-scrollbar { ... }
}
/* Manual restyling of every system UI part */
```


**Browser support:** Widely available · Since 2021 · 93% global usage

Browsers: Chrome 81+, Firefox 96+, Safari 13+, Edge 81+

[View on caniuse.com →](https://caniuse.com/mdn-css_properties_color-scheme) · [View on MDN →](https://developer.mozilla.org/en-US/docs/Web/CSS/color-scheme) · [View on webstatus.dev →](https://webstatus.dev/features/color-scheme) · [Learn more about Baseline →](https://web.dev/blog/announcing-baseline-in-action)


**Why the modern way wins:**

- **One declaration** -- The browser applies its native light or dark styling to form controls, scrollbars, and default backgrounds.
- **No form control hacks** -- No need to override every input and select for dark. They follow the scheme automatically.
- **Pairs with light-dark()** -- Use color-scheme with light-dark() or variables so your colors and system UI match.


**At a glance:**

- **Lines Saved:** 15+ → 3 (No manual dark form styles)
- **Old Approach:** Manual dark overrides (Restyle every control and scrollbar)
- **Modern Approach:** color-scheme (Browser handles system UI)


**How it works:**

The old approach was to add a `@media (prefers-color-scheme: dark)` block and manually set background and color on every input, select, textarea, and button, plus scrollbar styling. Lots of code and easy to miss a control.

`color-scheme: light dark` tells the browser that the page supports both schemes. The browser then uses its built-in light or dark styling for form controls, scrollbars, and the default canvas background, based on the user's preference. You still set your own colors for text and backgrounds; color-scheme handles the system-level parts so you do not have to.


### Inline conditional styles without JavaScript

*Workflow · Intermediate*

Conditional styling used to require JavaScript to toggle classes based on state. CSS if() lets you write inline conditions that respond to custom property values, media features, and container queries.


**Modern approach:**

```css
.btn {
  background: if(
    style(--variant: primary): blue;
    else: gray
  );
}
```

**Old approach:**

```css
/* Multiple class variants */
.btn { background: gray; }
.btn.primary { background: blue; }
.btn.danger { background: red; }

/* Plus JS to manage state */
el.classList.toggle(
 'primary',
 isPrimary
);

/* Duplicated rules per variant */
```


**Browser support:** Limited availability · 35% global usage

Browsers: Chrome 137+, Edge 137+

[View on caniuse.com →](https://caniuse.com/css-if-function) · [View on webstatus.dev →](https://webstatus.dev/features/if) · [Learn more about Baseline →](https://web.dev/blog/announcing-baseline-in-action)


**Why the modern way wins:**

- **Inline conditions** -- Write if/else logic directly in property values. No separate rule blocks for each variant.
- **Style queries** -- Test custom property values with style(). Respond to --variant, --size, --state without JavaScript class management.
- **Media-aware** -- Can also test media features like prefers-color-scheme or prefers-reduced-motion right inside a property value.


**At a glance:**

- **Variants:** Inline (No class toggling)
- **Old Approach:** JS + classes (Multiple rule blocks)
- **Modern Approach:** if() (Inline conditional)


**How it works:**

Component variants have always required separate CSS rules: `.btn.primary`, `.btn.danger`, `.btn.outlined`, each repeating the same properties with different values. JavaScript often manages which classes are applied, adding another layer of complexity.

CSS `if()` lets you write conditional logic inline. A single `.btn` rule can test `style(--variant: primary)` and choose values accordingly. It can also test media features like `prefers-color-scheme: dark` directly inside a property value, eliminating the need for separate `@media` blocks for simple value swaps.


### Lazy rendering without IntersectionObserver

*Workflow · Intermediate*

The old way used JavaScript's IntersectionObserver to detect when elements entered the viewport, then loaded or rendered them. Now CSS handles it with content-visibility: auto .


**Modern approach:**

```css
.section {
  content-visibility: auto;
  contain-intrinsic-size: auto 500px;
}
```

**Old approach:**

```css
// JavaScript
const observer = new IntersectionObserver(
 (entries) => {
   entries.forEach(entry => {
     if (entry.isIntersecting) {
       renderContent(entry.target);
     }
   });
 }
);
```


**Browser support:** Newly available · Since 2024 · 93% global usage

Browsers: Chrome 85+, Firefox 125+, Safari 18+, Edge 85+

[View on caniuse.com →](https://caniuse.com/css-content-visibility) · [View on MDN →](https://developer.mozilla.org/en-US/docs/Web/CSS/content-visibility) · [View on webstatus.dev →](https://webstatus.dev/features/content-visibility) · [Learn more about Baseline →](https://web.dev/blog/announcing-baseline-in-action)


**Why the modern way wins:**

- **Faster page loads** -- The browser skips layout and paint for offscreen content. Pages with long lists render significantly faster.
- **No JavaScript needed** -- IntersectionObserver requires setup code, callbacks, and cleanup. This is two CSS properties.
- **Automatic size estimation** -- The auto keyword in contain-intrinsic-size remembers the real size after first render, so scrollbar height stays accurate.


**At a glance:**

- **Lines Saved:** 10 → 2 (80% less code)
- **Old Approach:** JS Observer (Callback-based)
- **Modern Approach:** 2 properties (Declarative CSS)


**How it works:**

The old approach used JavaScript's `IntersectionObserver` API to watch elements as they scrolled into view. When an element crossed the viewport threshold, a callback would trigger rendering or loading. This required setup, teardown, and careful management of observer instances across the page.

With `content-visibility: auto`, the browser handles all of that internally. Offscreen content gets skipped during layout and paint, and `contain-intrinsic-size` provides a placeholder height so the scrollbar stays stable. When the user scrolls near the content, the browser renders it automatically.


### Nesting selectors without Sass or Less

*Workflow · Beginner*

Selector nesting was the #1 reason people reached for Sass. It's now built into CSS. Same & syntax, zero build tools.


**Modern approach:**

```css
.nav {
  display: flex;
  gap: 8px;

  & a {
    color: #888;
    text-decoration: none;

    &:hover {
      color: white;
    }
  }
}
```

**Old approach:**

```css
// nav.scss, requires Sass compiler
.nav {
 display: flex;
 gap: 8px;

 & a {
   color: #888;
   text-decoration: none;

   &:hover {
     color: white;
   }
 }
}
// sass --watch nav.scss nav.css
```


**Browser support:** Newly available · Since 2024 · 91% global usage

Browsers: Chrome 120+, Firefox 117+, Safari 17.2+, Edge 120+

[View on caniuse.com →](https://caniuse.com/css-nesting) · [View on MDN →](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_nesting) · [View on webstatus.dev →](https://webstatus.dev/features/nesting) · [Learn more about Baseline →](https://web.dev/blog/announcing-baseline-in-action)


**Why the modern way wins:**

- **No build step** -- Drop Sass, Less, PostCSS, or any compiler. Ship CSS directly to the browser, nesting included.
- **Familiar syntax** -- Same & nesting you already know from Sass. Near-zero learning curve for existing teams.
- **Smaller toolchain** -- One fewer dependency in your build. Faster installs, simpler CI, fewer things to break.


**At a glance:**

- **Dependency Removed:** Sass / Less (Build tool eliminated)
- **Old Approach:** .scss → .css (Compile step required)
- **Modern Approach:** .css → .css (Ship as-is)


**How it works:**

CSS nesting lets you write child selectors inside parent rule blocks using the `&` symbol, just like Sass. The browser interprets `.nav { & a { â€¦ } }` as `.nav a { â€¦ }`.

You can nest pseudo-classes (`&:hover`), pseudo-elements (`&::before`), and even media/container queries inside a rule block. The `&` always refers to the parent selector.

Unlike the initial release, the relaxed nesting syntax now matches Sass: you can write bare element selectors like `a { color: red }` directly inside a parent. The `&` is only required for compound selectors like `&:hover` or `&.active`.


### Range style queries without multiple blocks

*Workflow · Advanced*

Testing custom property ranges used to require multiple @container style() blocks or JavaScript comparisons. Range style queries let you write numeric comparisons directly: style(--progress > 50%).


**Modern approach:**

```css
.progress-container {
  container-type: style;
}

@container style(--progress > 75%) {
  .bar { background: var(--green); }
}

@container style(--progress > 25%) and style(--progress <= 75%) {
  .bar { background: var(--yellow); }
}
```

**Old approach:**

```css
/* Multiple discrete checks */
@container style(--progress: 0%) {
 .bar { background: red; }
}
@container style(--progress: 25%) {
 .bar { background: orange; }
}
@container style(--progress: 50%) {
 .bar { background: yellow; }
}
/* ... repeat for every threshold */

/* Or use JavaScript to set classes */
/* based on the numeric value */
```


**Browser support:** Limited availability · 88% global usage

Browsers: Chrome 111+

[View on caniuse.com →](https://caniuse.com/css-container-queries-style) · [View on MDN →](https://developer.mozilla.org/en-US/docs/Web/CSS/@container) · [View on webstatus.dev →](https://webstatus.dev/features/style-query-range-syntax) · [Learn more about Baseline →](https://web.dev/blog/announcing-baseline-in-action)


**Why the modern way wins:**

- **Numeric ranges** -- Compare custom property values with >, <, >=, <=. No need to enumerate every possible value.
- **Progress-based styling** -- Perfect for progress bars, sliders, and meters. Style changes at thresholds without JavaScript.
- **Combinable** -- Use 'and' to create ranges: style(--x > 25%) and style(--x <= 75%). Clean, readable thresholds.


**At a glance:**

- **Operators:** > < >= <= (Numeric comparisons)
- **Old Approach:** Discrete checks (One block per value)
- **Modern Approach:** Range syntax (style(--x > 50%))


**How it works:**

Style queries (`@container style()`) landed with equality checks: you can test `style(--theme: dark)`. But for numeric values like progress, temperature, or scores, you had to write separate blocks for each discrete value — or fall back to JavaScript for range-based class toggling.

Range style queries add comparison operators to style queries. You write `@container style(--progress > 75%)` to match any value above 75%. Combine ranges with `and`: `style(--progress > 25%) and style(--progress <= 75%)`. This enables pure CSS progress bars, data visualizations, and state-dependent styling without any JavaScript.


### Reusable CSS logic without Sass mixins

*Workflow · Intermediate*

Reusable calculations and logic in stylesheets used to require Sass or other preprocessors. Native CSS @function lets you define custom functions that return computed values, right in your stylesheet.


**Modern approach:**

```css
@function --fluid(--min, --max) {
  @return clamp(
    var(--min),
    50vi,
    var(--max)
  );
}

h1 {
  font-size: --fluid(1.5rem, 3rem);
}
```

**Old approach:**

```css
// Sass / SCSS
@function fluid($min, $max) {
 @return clamp(
   #{$min},
   #{$min} + (#{$max} - #{$min}) * ...,
   #{$max}
 );
}

/* Requires build step to compile */
```


**Browser support:** Limited availability · 67% global usage

Browsers: Chrome 137+, Edge 137+

[View on caniuse.com →](https://caniuse.com/css-at-function) · [View on webstatus.dev →](https://webstatus.dev/features/function) · [Learn more about Baseline →](https://web.dev/blog/announcing-baseline-in-action)


**Why the modern way wins:**

- **No build step** -- Native CSS functions run in the browser. No Sass compiler, no PostCSS plugin, no build pipeline required.
- **Runtime computed** -- Unlike Sass which compiles to static values, CSS @function can use runtime values like viewport units, custom properties, and env().
- **Composable** -- Functions can call other functions and use custom properties. Build complex design token systems with pure CSS.


**At a glance:**

- **Build Step:** None (Runs in browser)
- **Old Approach:** Sass functions (Requires compiler)
- **Modern Approach:** @function (Native CSS)


**How it works:**

Preprocessors like Sass introduced functions decades ago, allowing developers to encapsulate reusable calculations. But Sass functions compile to static values at build time — they can't react to runtime conditions like viewport size changes or user preferences.

CSS `@function` brings this capability natively to the browser. You define a function with `@function --name(--param) { @return ... }` and call it anywhere a value is expected: `font-size: --fluid(1rem, 2rem)`. Because it runs at runtime, it can use viewport units, custom properties, and other dynamic values that Sass simply can't access.


### Scoped styles without BEM naming

*Workflow · Advanced*

To avoid leaks you used BEM, CSS Modules, or styled-components. @scope limits selectors to a root and optional boundary so you can use short names safely.


**Modern approach:**

```css
@scope (.card) {
  .title {
    font-size: 1.25rem;
    margin-bottom: 0.5rem;
  }
  .body { color: #444; }
}
```

**Old approach:**

```css
/* BEM: long names to avoid collisions */
.card__title {
 font-size: 1.25rem;
 margin-bottom: 0.5rem;
}
.card__body { color: #444; }
/* HTML: class="card__title" */
```


**Browser support:** Newly available · Since 2024 · 84% global usage

Browsers: Chrome 118+, Firefox 128+, Safari 17.4+, Edge 118+

[View on caniuse.com →](https://caniuse.com/mdn-css_at-rules_scope) · [View on MDN →](https://developer.mozilla.org/en-US/docs/Web/CSS/@scope) · [View on webstatus.dev →](https://webstatus.dev/features/scope) · [Learn more about Baseline →](https://web.dev/blog/announcing-baseline-in-action)


**Why the modern way wins:**

- **Short names** -- Use .title and .body. They only apply inside the scoped root, so no collisions.
- **No build** -- No CSS Modules hash or styled-components runtime. Plain CSS, native in the browser.
- **Boundary** -- Optional to (.root) to (.boundary) so inner components don't get styled by outer scope.


**At a glance:**

- **Lines Saved:** Same lines, less naming (No BEM prefix)
- **Old Approach:** BEM or CSS-in-JS (Long names or build step)
- **Modern Approach:** @scope (Native scoping)


**How it works:**

Global CSS meant long class names (BEM like .card__title) or a system that generated unique names (CSS Modules, styled-components). The goal was to avoid one component's .title affecting another.

`@scope (.card) { .title { â€¦ } }` makes .title only match elements inside a .card. You can use simple class names and keep styles local. Add a boundary with `@scope (.panel) to (.slot)` so the scope doesn't cross into nested components that should stay independent.


### Theme variables without a preprocessor

*Workflow · Beginner*

Sass and LESS variables compile to static values. Custom properties live in the browser and can change at runtime.


**Modern approach:**

```css
:root {
  --primary: #7c3aed;
  --spacing: 16px;
}
.btn { background: var(--primary); }
```

**Old approach:**

```css
// Sass/LESS: compile-time only
$primary: #7c3aed;
$spacing: 16px;

.btn {
 background: $primary;
}
// Output is static. Change theme = recompile.
```


**Browser support:** Widely available · Since 2017 · 96% global usage

Browsers: Chrome 49+, Firefox 31+, Safari 9.1+, Edge 16+

[View on caniuse.com →](https://caniuse.com/css-variables) · [View on MDN →](https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties) · [View on webstatus.dev →](https://webstatus.dev/features/custom-properties) · [Learn more about Baseline →](https://web.dev/blog/announcing-baseline-in-action)


**Why the modern way wins:**

- **Runtime updates** -- Change --primary in JS or a class and every use updates. No rebuild.
- **No build step** -- Plain CSS. Works in any environment, no Sass or LESS required.
- **Cascade and override** -- Set on :root, override in .dark or a component. Inherits like normal CSS.


**At a glance:**

- **Lines Saved:** N/A (No preprocessor)
- **Old Approach:** Sass/LESS vars (Compile to static values)
- **Modern Approach:** Custom properties (Update at runtime)


**How it works:**

Preprocessor variables like `$primary: #7c3aed` are replaced at compile time. The output is plain hex. To switch themes you recompile or generate multiple stylesheets.

Custom properties (`--primary: #7c3aed`) are real CSS. You read and set them with `var(--primary)`. Toggle a class on the root or use JS to change --primary and every reference updates. No build, no duplicate CSS.


### Typed attribute values without JavaScript

*Workflow · Intermediate*

Reading data attributes for styling used to require JavaScript to parse dataset values and set inline styles or custom properties. Advanced attr() lets CSS read HTML attributes directly as typed values — numbers, colors, lengths, and more.


**Modern approach:**

```css
.bar {
  width: attr(data-pct type(<percentage>));
}

/* HTML: <div class="bar" data-pct="75%"> */
```

**Old approach:**

```css
/* JS: read data attr and set style */
document.querySelectorAll('.bar')
 .forEach(el => {
   const pct = el.dataset.pct;
   el.style.width = pct + '%';
   el.style.setProperty(
     '--pct', pct
   );
 });
```


**Browser support:** Limited availability · 42% global usage

Browsers: Chrome 132+, Edge 132+

[View on caniuse.com →](https://caniuse.com/css-advanced-attr-values) · [View on MDN →](https://developer.mozilla.org/en-US/docs/Web/CSS/attr) · [View on webstatus.dev →](https://webstatus.dev/features/attr) · [Learn more about Baseline →](https://web.dev/blog/announcing-baseline-in-action)


**Why the modern way wins:**

- **No JavaScript bridge** -- Read data attributes directly in CSS without JavaScript parsing, type conversion, or custom property bridges.
- **Type coercion** -- Specify the expected type: , , , . The browser handles parsing and validation.
- **Fallback values** -- Provide a fallback if the attribute is missing or invalid: attr(data-x type( ), 1rem).


**At a glance:**

- **Types:** All CSS types (<number>, <color>, etc.)
- **Old Approach:** JS dataset (el.dataset.x)
- **Modern Approach:** attr() types (attr(x type(...)))


**How it works:**

The `attr()` function has existed in CSS for years, but it could only return strings and was limited to the `content` property. To use data attributes for layout or color, you had to write JavaScript that reads `el.dataset`, converts the value, and sets it as an inline style or custom property.

Advanced `attr()` adds type coercion. You write `attr(data-pct type(<percentage>))` and the browser reads the HTML attribute, parses it as a percentage, and uses it as a typed CSS value. This works with `<number>`, `<length>`, `<color>`, `<angle>`, and more. You can even provide fallbacks for missing or invalid attributes.


### Typed custom properties without JavaScript

*Workflow · Advanced*

Custom properties were strings. You couldn't animate them or get browser validation. @property gives you a type, so the browser can interpolate and validate.


**Modern approach:**

```css
@property --hue {
  syntax: "<angle>";
  inherits: false;
  initial-value: 0deg;
}

.wheel {
  background: hsl(var(--hue), 80%, 50%);
  transition: --hue .3s;
}
```

**Old approach:**

```css
:root { --hue: 0; }
.wheel {
 background: hsl(var(--hue), 80%, 50%);
 transition: --hue .3s; /* ignored, not interpolable */
}
```


**Browser support:** Newly available · Since 2024 · 92% global usage

Browsers: Chrome 85+, Firefox 128+, Safari 16.4+, Edge 85+

[View on caniuse.com →](https://caniuse.com/mdn-css_at-rules_property) · [View on MDN →](https://developer.mozilla.org/en-US/docs/Web/CSS/@property) · [View on webstatus.dev →](https://webstatus.dev/features/registered-custom-properties) · [Learn more about Baseline →](https://web.dev/blog/announcing-baseline-in-action)


**Why the modern way wins:**

- **Animatable** -- Transition or animate custom properties. The browser interpolates by type.
- **Validated** -- Invalid values fall back to initial-value. No silent string surprises.
- **No JS** -- No script to parse or tween. Pure CSS for hue, length, or number transitions.


**At a glance:**

- **Lines Saved:** JS → 0 (No script for tweening)
- **Old Approach:** Untyped string (No animation, no validation)
- **Modern Approach:** @property (syntax + initial-value)


**How it works:**

Custom properties were untyped. The browser stored them as strings, so you couldn't transition from 0 to 360 for a hue, and invalid values weren't caught. You needed JS to tween or validate.

`@property --name { syntax: "<angle>"; inherits: false; initial-value: 0deg; }` registers the variable with a type. The browser can interpolate it in transitions and animations and will reject invalid values. Syntax can be `<length>`, `<color>`, `<number>`, and more.



---

## Articles

### Build an accessible carousel with only CSS

*By Naeem Noor · 2026-02-09*

Carousels have always required JavaScript libraries. With new CSS pseudo-elements for scroll navigation, you can build one with zero JS that's accessible out of the box.


##### Why a CSS-only carousel?

JavaScript carousel libraries — Swiper.js, Slick, Flickity, Embla — have been staples of web development for years. They provide navigation buttons, dot indicators, touch support, and snap behavior. But they also add 30-100 KB of JavaScript, require initialization, and often need careful ARIA work to be accessible.

CSS now provides native pseudo-elements that generate the same UI affordances: `::scroll-button()` for prev/next navigation and `::scroll-marker` for dot indicators. These are browser-generated, focusable, keyboard-accessible, and auto-disabled at scroll boundaries. Zero JavaScript required.


##### Step 1: Set up the scroll container

Start with a simple HTML list inside a scrollable container:


```css
<ul class="carousel">
  <li>Slide 1</li>
  <li>Slide 2</li>
  <li>Slide 3</li>
  <li>Slide 4</li>
</ul>
```

Make it horizontally scrollable with scroll snapping:


```css
.carousel {
  display: flex;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  gap: 16px;
}

.carousel li {
  flex: 0 0 100%;
  scroll-snap-align: center;
}
```


*Demo: Basic scroll-snap carousel*


##### Step 2: Add navigation buttons

The `::scroll-button()` pseudo-element creates browser-provided scroll buttons on a scroll container. They behave like regular buttons: focusable, clickable, and automatically disabled when scrolling is no longer possible in a given direction.


```css
.carousel::scroll-button(left) {
  content: "←" / "Previous slide";
  background: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 50%;
  width: 40px;
  height: 40px;
}

.carousel::scroll-button(right) {
  content: "→" / "Next slide";
  /* same styles */
}
```

When activated, each button scrolls the container by approximately 85% of its visible area. The second value after the `/` in the `content` property sets the accessible label.


##### Step 3: Add dot indicators

The `::scroll-marker` pseudo-element represents a navigation marker for each item in the scroll container. These are grouped automatically and behave like anchor links, letting users jump directly to a specific slide.


```css
.carousel {
  scroll-marker-group: after;
}

.carousel li::scroll-marker {
  content: '';
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #ccc;
  border: none;
}
```

The `scroll-marker-group: after` property places the marker group after the carousel content. You can also use `before` to place it above.


##### Step 4: Style the active marker

The `:target-current` pseudo-class matches the marker whose corresponding item is currently scrolled into view:


```css
.carousel li::scroll-marker:target-current {
  background: #7c3aed;
  transform: scale(1.2);
}
```

This gives you the classic "active dot" indicator that updates automatically as the user scrolls. No JavaScript IntersectionObserver or scroll position calculation needed.


##### The complete carousel

Here's the entire CSS for a fully functional, accessible carousel:


```css
.carousel {
  display: flex;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  gap: 16px;
  scroll-marker-group: after;
}

.carousel li {
  flex: 0 0 100%;
  scroll-snap-align: center;
}

.carousel::scroll-button(left) {
  content: "←" / "Previous";
}
.carousel::scroll-button(right) {
  content: "→" / "Next";
}

.carousel li::scroll-marker {
  content: '';
  width: 12px; height: 12px;
  border-radius: 50%;
  background: #ccc;
}

.carousel li::scroll-marker:target-current {
  background: #7c3aed;
}
```

That's it. No JavaScript, no library, no ARIA attributes to manage. The browser handles keyboard navigation, focus management, scroll snapping, and active state tracking natively.


*Demo: Complete carousel with nav + markers*


##### Browser support

`::scroll-button()` and `::scroll-marker` are available in Chrome and Edge. Firefox and Safari implementations are in progress. For a progressive enhancement approach, wrap the scroll-button and scroll-marker styles in `@supports (scroll-marker-group: after)` and provide a basic scrollable fallback for unsupported browsers.


### Build a fully styled select dropdown with base-select

*By Naeem Noor · 2026-02-09*

The HTML select element has been un-stylable for decades. With appearance: base-select, you can finally customize every part of it with pure CSS.


##### The problem with styling selects

The `<select>` element has been one of the biggest pain points in web development for over two decades. Unlike almost every other HTML element, the browser-rendered dropdown was essentially a black box. You could change the font and colors of the button, but the dropdown list, the options, the arrow indicator — all untouchable.

This led to an entire ecosystem of JavaScript replacements: Select2, Choices.js, React Select, Headless UI Listbox, and dozens more. These libraries replace the native `<select>` with a fully custom DOM structure, then re-implement keyboard navigation, ARIA attributes, focus management, and form participation from scratch.

The cost? Extra JavaScript weight (Select2 is ~30 KB gzipped), accessibility bugs, maintenance burden, and a fundamentally different element that just looks like a select. With `appearance: base-select`, that era is over.


##### Step 1: Enable base-select mode

The opt-in is simple. Apply `appearance: base-select` to both the `<select>` and its `::picker(select)` pseudo-element:


```css
select,
select ::picker(select) {
  appearance: base-select;
}
```

This switches the select to a minimal, fully stylable foundation. The browser strips away its default chrome and gives you raw building blocks: the button, the dropdown, the options, and a new `<selectedcontent>` element.


##### Step 2: Style the select button

With base-select enabled, the `<select>` element itself becomes the button. Style it like any other element:


```css
select {
  padding: 12px 16px;
  border: 1px solid #ccc;
  border-radius: 8px;
  font-size: 1rem;
  background: #fff;
  cursor: pointer;
}
```

You can also style the dropdown arrow indicator using the `::picker-icon` pseudo-element, or replace it entirely with a custom icon using `::after`.


*Demo: Styled select button*


##### Step 3: Customize the dropdown

The dropdown list is accessed via `::picker(select)`. It renders in the top layer, meaning it won't be clipped by parent containers with `overflow: hidden`. The browser also handles positioning and flipping automatically based on viewport space.


```css
select ::picker(select) {
  border: 1px solid #e0e0e0;
  border-radius: 12px;
  padding: 8px;
  box-shadow: 0 8px 32px rgba(0,0,0,.12);
}
```


##### Step 4: Style individual options

Options are fully stylable too. You can even include rich HTML content like images and icons inside them:


```css
option {
  padding: 10px 14px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 10px;
}

option:checked {
  background: rgba(124, 58, 237, 0.1);
}
```

This means you can build country pickers with flag icons, user selectors with avatars, or color pickers with swatches — all with the native `<select>` element.


*Demo: Complete styled select with options*


##### Step 5: Reflect selected content

The new `<selectedcontent>` element is placed inside the `<select>` button and mirrors the HTML of the currently selected option. This means if your option has an icon and a label, the button shows the same icon and label.


```css
<select>
  <button>
    <selectedcontent></selectedcontent>
  </button>
  <option value="us">
    <img src="us.svg"> United States
  </option>
</select>
```

You can selectively hide parts of the reflected content. For instance, show only an icon in the button while the full option shows icon + name + description:


```css
selectedcontent .description {
  display: none;
}
```


##### Browser support

As of early 2026, `appearance: base-select` is supported in Chrome 134+ and Edge 134+. Firefox and Safari are actively implementing it. For browsers without support, the native select works as a perfectly functional fallback — users just see the default browser styling.

This is a true progressive enhancement: the feature is opt-in, the fallback is the native element, and no JavaScript is needed for either path.


### Build a tooltip system with popover hint and anchor positioning

*By Naeem Noor · 2026-02-09*

Tooltips have always required JavaScript for hover handling, positioning, and cleanup. Combine popover=hint with CSS anchor positioning for a fully declarative tooltip system.


##### The tooltip problem

Building good tooltips is surprisingly hard. You need hover detection (mouseenter/mouseleave), focus management (focus/blur for keyboard), a delay to prevent accidental triggers, position calculation relative to the trigger element, viewport-aware flipping, and cleanup on unmount. Libraries like Tippy.js and Floating UI exist entirely because this combination is so error-prone.

Modern CSS and HTML now give us three features that, combined, replace all of that JavaScript: `popover=hint` for the tooltip layer, `interestfor` for declarative hover/focus triggering, and CSS anchor positioning for automatic placement.


##### Step 1: Create the popover hint

The `popover=hint` type is designed for ephemeral UI like tooltips. Unlike `popover=auto`, hint popovers don't close other open popovers — they layer naturally:


```css
<button id="trigger">Hover me</button>

<div id="tooltip" popover=hint>
  Helpful tooltip text
</div>
```

The tooltip renders in the top layer when shown, so it won't be clipped by `overflow: hidden` on any ancestor.


##### Step 2: Wire up the interestfor trigger

The `interestfor` attribute on the trigger element handles all the event logic: hover with a configurable delay, keyboard focus, and even touch long-press:


```css
<button id="trigger"
  interestfor="tooltip">
  Hover me
</button>
```

That's it for the trigger. The browser shows the tooltip on hover (after a 0.5s default delay) and hides it when the user moves away. You can customize the delay:


```css
[interestfor] {
  interest-delay: 0.2s;
}
```

Unlike `commandfor` (which only works on buttons), `interestfor` also works on `<a>` tags, making it ideal for link previews and hover cards.


*Demo: Hover or focus to show tooltip*


##### Step 3: Position with CSS anchoring

CSS anchor positioning ties the tooltip to its trigger without any JavaScript position calculation:


```css
#trigger {
  anchor-name: --trigger;
}

#tooltip {
  position: fixed;
  position-anchor: --trigger;
  top: anchor(bottom);
  left: anchor(center);
  translate: -50% 8px;
}
```

The tooltip is now anchored below the trigger, centered horizontally. The browser keeps this position in sync automatically — no scroll listeners or resize observers needed.


##### Step 4: Add viewport-aware flipping

If the tooltip would overflow the viewport, use `position-try-fallbacks` to flip it:


```css
#tooltip {
  position-try-fallbacks: flip-block;
}
```

This tells the browser to try flipping the tooltip to the opposite side (above the trigger) if there isn't enough room below. You can also define custom fallback positions for more complex scenarios.


##### Step 5: Style and animate

Style the tooltip with CSS and add entry/exit animations:


```css
#tooltip {
  background: #1a1a22;
  color: #e4e4e7;
  padding: 8px 14px;
  border-radius: 8px;
  font-size: 0.85rem;
  box-shadow: 0 4px 16px rgba(0,0,0,.2);

  /* Entry animation */
  transition: opacity 0.2s, translate 0.2s;
  transition-behavior: allow-discrete;

  @starting-style {
    opacity: 0;
    translate: -50% 16px;
  }
}
```

Using `@starting-style` with `transition-behavior: allow-discrete` gives you smooth entry animations from the hidden state, and the browser handles the exit animation automatically.


*Demo: Styled & animated tooltips*


##### Making it reusable

For a multi-tooltip system, use unique anchor names per trigger-tooltip pair. The `attr()` function with typed values can automate this:


```css
[interestfor] {
  anchor-name: attr(id type(<custom-ident>));
}

[popover=hint] {
  position-anchor: attr(anchor type(<custom-ident>));
}
```

This pattern scales to any number of tooltips without unique CSS rules per tooltip. Combined with `popover=hint` and `interestfor`, you have a complete tooltip system in pure HTML and CSS.


*Demo: Reusable tooltip system — multiple positions*


##### Browser support

The full combination of `popover=hint`, `interestfor`, and CSS anchor positioning is available in Chrome 135+ and Edge 135+. For progressive enhancement, provide a `title` attribute fallback on triggers so users in unsupported browsers still get native browser tooltips. The `popover` attribute is a no-op in browsers that don't support it, so the page won't break.



---

## What's New in CSS

### What's New in CSS 2026

CSS features shipping in 2026. Mixins, cross-document view transitions, gap decorations, reading flow, and more browser interop improvements.

#### CSS Mixins (@mixin)

*Workflow · Editor's Draft · Shipped in Chrome 146 (expected)*

Define reusable blocks of declarations with @mixin --name { ... } and apply them with @apply --name. Like Sass mixins but native, with support for parameters and conditional logic.


```css
@mixin --center {
  display: flex;
  align-items: center;
  justify-content: center;
}

.card { @apply --center; }
```

**Use case:** Replace Sass/PostCSS mixins with native CSS. Share layout patterns, theme tokens, and responsive utilities across components without a build step.

**Browsers:** Chrome, Edge

**Spec:** https://drafts.csswg.org/css-mixins/


#### Cross-Document View Transitions

*Animation · Working Draft · Shipped in Chrome 134, Safari 18.2*

View transitions now work across full page navigations (MPA), not just SPA. Use @view-transition { navigation: auto } to animate between pages served by the same origin.


```css
@view-transition {
  navigation: auto;
}

::view-transition-old(root) {
  animation: fade-out 0.3s;
}
::view-transition-new(root) {
  animation: fade-in 0.3s;
}
```

**Use case:** Add smooth page-to-page transitions in multi-page apps without JavaScript frameworks. Works with standard links and form navigations.

**Browsers:** Chrome, Safari, Edge

**Spec:** https://drafts.csswg.org/css-view-transitions-2/


#### CSS Gap Decorations

*Layout · Editor's Draft · Shipped in Chrome 147 (expected)*

Style the gaps in grid and flex layouts with column-rule-like properties for both axes. Draw lines, dashes, or gradients between grid tracks without extra DOM elements.


```css
.grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 20px;
  column-rule: 1px solid #ccc;
  row-rule: 1px dashed #eee;
}
```

**Use case:** Add separators between grid items — like table borders or card dividers — without pseudo-elements or wrapper elements. Supports all border-style values.

**Browsers:** Chrome, Edge

**Spec:** https://drafts.csswg.org/css-gap-decorations/


#### Reading Flow

*Layout · Editor's Draft · Shipped in Chrome 137*

Control the keyboard tab and screen reader navigation order of flex and grid children with reading-flow: flex-visual or grid-rows. No need for manual tabindex reordering.


```css
.flex-nav {
  display: flex;
  flex-direction: row-reverse;
  reading-flow: flex-visual;
}

.grid-layout {
  display: grid;
  reading-flow: grid-rows;
}
```

**Use case:** Fix accessibility issues where visual order differs from DOM order. Ensures keyboard and assistive technology users navigate in the visually expected order.

**Browsers:** Chrome, Edge

**Spec:** https://drafts.csswg.org/css-display-4/#reading-flow


#### Scroll-Driven Animations Interop

*Animation · Working Draft · Shipped in Baseline 2026 (expected)*

animation-timeline: scroll() and view() reach cross-browser baseline. Firefox and Safari ship full support, making scroll-driven animations production-ready without prefixes.


```css
.reveal {
  animation: fade-in linear;
  animation-timeline: view();
  animation-range: entry 0% entry 100%;
}

@keyframes fade-in {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
```

**Use case:** Create scroll-triggered reveal effects, progress bars, parallax, and scroll-linked transforms without JavaScript IntersectionObserver or scroll event listeners.

**Browsers:** Chrome, Firefox, Edge, Safari

**Spec:** https://drafts.csswg.org/scroll-animations-1/


#### Masonry Layout

*Layout · Editor's Draft · Shipped in Firefox 140 (behind flag), Chrome (in development)*

Native CSS masonry via display: masonry or grid-template-rows: masonry. Pinterest-style layouts without JavaScript. Items fill vertical gaps automatically based on content height.


```css
.gallery {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  grid-template-rows: masonry;
  gap: 16px;
}
```

**Use case:** Build Pinterest-style image galleries, card feeds, and blog layouts where items have varying heights. No need for Masonry.js or manual column calculation.

**Browsers:** Firefox, Chrome

**Spec:** https://drafts.csswg.org/css-grid-3/


#### Relative Color Syntax Interop

*Color · Working Draft · Shipped in Baseline 2026*

oklch(from var(--base) ...) and color-mix() reach full cross-browser baseline. All major engines now support relative color manipulation natively.


```css
:root { --brand: oklch(65% 0.25 260); }

.lighter {
  color: oklch(from var(--brand) calc(l + 0.2) c h);
}
.muted {
  color: oklch(from var(--brand) l calc(c * 0.5) h);
}
```

**Use case:** Generate entire color palettes from a single brand color. Lighten, darken, desaturate, or shift hue without Sass functions or hardcoded hex values.

**Browsers:** Chrome, Firefox, Safari, Edge

**Spec:** https://drafts.csswg.org/css-color-5/#relative-colors


#### @starting-style Interop

*Animation · Working Draft · Shipped in Baseline 2026*

@starting-style reaches cross-browser baseline, enabling entry animations from display: none without JavaScript timing hacks in all major browsers.


```css
dialog[open] {
  opacity: 1;
  transform: scale(1);
  transition: opacity 0.3s, transform 0.3s;
}

@starting-style {
  dialog[open] {
    opacity: 0;
    transform: scale(0.95);
  }
}
```

**Use case:** Animate dialogs, popovers, and conditionally-rendered elements on first display. No more requestAnimationFrame hacks to trigger entry transitions.

**Browsers:** Chrome, Firefox, Safari, Edge

**Spec:** https://drafts.csswg.org/css-transitions-2/#defining-before-change-style


#### CSS Custom Highlight API Improvements

*Selector · Working Draft · Shipped in Chrome 137, Firefox (in development)*

The Highlight API gains new features for custom text highlighting. Create spell-check indicators, search highlights, and collaborative editing marks with pure CSS styling.


```css
/* JavaScript: create ranges */
const range = new Range();
range.setStart(node, 0);
range.setEnd(node, 5);
CSS.highlights.set('search', new Highlight(range));

/* CSS: style the highlight */
::highlight(search) {
  background: oklch(85% 0.15 90);
  color: black;
}
```

**Use case:** Build find-and-replace, code syntax highlighting, spell-check underlines, and collaborative cursors without wrapping text in <span> elements.

**Browsers:** Chrome, Edge, Firefox

**Spec:** https://drafts.csswg.org/css-highlight-api-1/


#### Scoped Styles Interop (@scope)

*Selector · Working Draft · Shipped in Chrome 134, Firefox (in development)*

@scope reaches broader browser support. Proximity-based styling with upper and lower bounds becomes a practical alternative to BEM and CSS Modules.


```css
@scope (.card) to (.card-content) {
  :scope {
    border: 1px solid #ddd;
    border-radius: 12px;
  }
  h2 { font-size: 1.2rem; }
  p  { color: gray; }
}
```

**Use case:** Scope styles to a component without class-name conventions or build tools. The 'to' boundary prevents styles from leaking into nested sub-components.

**Browsers:** Chrome, Edge, Firefox, Safari

**Spec:** https://drafts.csswg.org/css-cascade-6/#scoped-styles



### What's New in CSS 2025

A timeline of CSS features that shipped in browsers in 2025. Customizable selects, invoker commands, CSS functions, scroll-state queries, and much more.

#### Customizable Select

*Layout · Working Draft · Shipped in Chrome 134*

Fully style HTML select dropdowns with appearance: base-select. The dropdown renders in the top layer, supports rich HTML in options, and the new selectedcontent element reflects the chosen option.


```css
select {
  appearance: base-select;
}

select::picker(select) {
  background: #1a1a2e;
  border: 1px solid #333;
  border-radius: 12px;
  padding: 8px;
}
```

**Use case:** Build fully branded select dropdowns without JavaScript libraries like Select2 or Choices.js. Style the button, picker, options, and selected content with standard CSS.

**Browsers:** Chrome, Edge, Firefox, Safari

**Spec:** https://drafts.csswg.org/css-ui-4/#widget-accent


#### Invoker Commands

*Layout · Explainer · Shipped in Chrome 135*

Buttons can now perform actions on other elements declaratively with commandfor and command attributes. Open modals, toggle popovers, and close dialogs without JavaScript.


```css
<button commandfor="my-dialog" command="show-modal">
  Open Dialog
</button>

<dialog id="my-dialog">
  <p>Hello!</p>
  <button commandfor="my-dialog" command="close">
    Close
  </button>
</dialog>
```

**Use case:** Wire up interactive UI — modals, popovers, toggle panels — with HTML attributes alone. No addEventListener, no onclick handlers, no framework needed.

**Browsers:** Chrome, Edge, Firefox, Safari

**Spec:** https://open-ui.org/components/invokers.explainer/


#### Dialog Light Dismiss

*Layout · Living Standard · Shipped in Chrome 134*

The closedby attribute brings popover-style light dismiss to dialogs. Set closedby="any" to close on backdrop click or ESC, or closedby="closerequest" for ESC only.


```css
<!-- Close on backdrop click or ESC -->
<dialog closedby="any">
  <p>Click outside to close</p>
</dialog>

<!-- Close on ESC only -->
<dialog closedby="closerequest">
  <p>Press ESC to close</p>
</dialog>
```

**Use case:** Eliminate click-outside event listeners for modal dismissal. The closedby attribute handles backdrop clicks and keyboard dismiss natively.

**Browsers:** Chrome, Edge, Firefox, Safari

**Spec:** https://html.spec.whatwg.org/multipage/interactive-elements.html#the-dialog-element


#### popover=hint & Interest Invokers

*Layout · Living Standard · Shipped in Chrome 135*

Hint popovers are ephemeral and don't close other popovers. The interestfor attribute triggers them on hover/focus declaratively. Perfect for tooltips and hovercards.


```css
<button interestfor="my-tip">
  Hover me
</button>

<div id="my-tip" popover="hint">
  This is a tooltip!
</div>
```

**Use case:** Build tooltips and hovercards that appear on hover/focus without JavaScript mouseenter/mouseleave event listeners. Hint popovers coexist with other open popovers.

**Browsers:** Chrome, Edge

**Spec:** https://html.spec.whatwg.org/multipage/popover.html#the-popover-attribute


#### Scroll-State Container Queries

*Animation · Editor's Draft · Shipped in Chrome 133*

Style descendants based on whether a scroll container is stuck, snapped, or scrollable. Use container-type: scroll-state with @container scroll-state() queries.


```css
.sticky-header {
  position: sticky;
  top: 0;
  container-type: scroll-state;
}

@container scroll-state(stuck: top) {
  .sticky-header {
    box-shadow: 0 2px 8px rgba(0,0,0,.15);
    backdrop-filter: blur(12px);
  }
}
```

**Use case:** Add shadow to a sticky header when it sticks, highlight a snapped carousel slide, or show scroll indicators when a container is scrollable — all without JavaScript scroll listeners.

**Browsers:** Chrome, Edge

**Spec:** https://drafts.csswg.org/css-conditional-5/#scroll-state-container-queries


#### Tree Counting Functions

*Animation · Working Draft · Shipped in Chrome 136*

sibling-index() returns an element's position among siblings; sibling-count() returns the total. Ideal for staggered animations and dynamic layouts without manual indexing.


```css
.card {
  animation-delay: calc(sibling-index() * 80ms);
  opacity: 0;
  animation: fade-in 0.4s forwards;
}

.item {
  flex-basis: calc(100% / sibling-count());
}
```

**Use case:** Create staggered entrance animations and equal-width flex layouts without nth-child hacks or custom properties on every element. The functions update dynamically when items are added or removed.

**Browsers:** Chrome, Edge

**Spec:** https://drafts.csswg.org/css-values-5/#tree-counting


#### CSS Scroll Markers & Buttons

*Layout · Editor's Draft · Shipped in Chrome 135*

Build carousels with CSS-only pseudo-elements. ::scroll-button() creates navigation arrows, ::scroll-marker creates dot indicators. Both are accessible and stylable.


```css
.carousel {
  overflow-x: auto;
  scroll-snap-type: x mandatory;
}

.carousel::scroll-button(left) {
  content: '←';
}
.carousel::scroll-button(right) {
  content: '→';
}

.carousel > * {
  scroll-snap-align: center;
}
.carousel > *::scroll-marker {
  content: '';
  border-radius: 50%;
  width: 10px; height: 10px;
  background: gray;
}
```

**Use case:** Build accessible carousels with prev/next buttons and dot indicators using only CSS. No Swiper.js, no Flickity, no JavaScript event wiring needed.

**Browsers:** Chrome, Edge, Firefox, Safari

**Spec:** https://drafts.csswg.org/css-overflow-5/#scroll-markers


#### text-box (trim & edge)

*Typography · Working Draft · Shipped in Chrome 133, Safari 18.2*

Trim invisible font metric space for true optical centering. text-box: trim-both cap alphabetic removes ascent/descent padding so text is visually centered in buttons, badges, and headings.


```css
.button {
  text-box: trim-both cap alphabetic;
  /* shorthand for:
     text-box-trim: trim-both;
     text-box-edge: cap alphabetic; */
}

h1 {
  text-box: trim-both cap alphabetic;
  /* text sits flush — no phantom spacing */
}
```

**Use case:** Vertically center text in buttons, badges, and pill labels without padding hacks. Align headings flush to their container edge without invisible font metric space.

**Browsers:** Chrome, Safari, Edge, Firefox

**Spec:** https://drafts.csswg.org/css-inline-3/#text-box-trim


#### CSS if() Function

*Workflow · Working Draft · Shipped in Chrome 137*

Conditional values in CSS properties. Use if(media(...): value; else: fallback) for inline media queries, if(supports(...): ...) for feature queries, and if(style(...): ...) for style queries.


```css
.container {
  padding: if(
    media(width >= 768px): 40px;
    else: 16px
  );

  display: if(
    supports(display: grid): grid;
    else: flex
  );
}
```

**Use case:** Write conditional property values inline without separate @media or @supports blocks. Ideal for one-off responsive adjustments and progressive enhancement directly in declarations.

**Browsers:** Chrome, Edge

**Spec:** https://drafts.csswg.org/css-values-5/#if-notation


#### CSS Custom Functions (@function)

*Workflow · Editor's Draft · Shipped in Chrome 137*

Define reusable functions with @function --name(args) { @return ... }. Write composable, maintainable CSS logic like conditional border-radius, clamped values, and utility helpers.


```css
@function --fluid-size(--min, --max) {
  @return clamp(
    var(--min),
    var(--min) + (var(--max) - var(--min)) * 
      (100vw - 320px) / (1200 - 320),
    var(--max)
  );
}

h1 { font-size: --fluid-size(1.5rem, 3rem); }
```

**Use case:** Replace Sass functions with native CSS. Build reusable utility functions for fluid sizing, conditional radius, spacing scales, and color manipulation — no build step required.

**Browsers:** Chrome, Edge

**Spec:** https://drafts.csswg.org/css-mixins/#functions


#### Advanced attr() Function

*Workflow · Working Draft · Shipped in Chrome 133*

attr() now works beyond content property and can parse values as typed data: colors, lengths, numbers, and custom identifiers. Use with any CSS property.


```css
<div data-color="#7c3aed" data-size="200">

.box {
  background: attr(data-color type(<color>));
  width: attr(data-size type(<length>), 100px);
  /* typed parsing with fallback */
}
```

**Use case:** Drive CSS property values from HTML data attributes without JavaScript. Set colors, sizes, delays, and any typed value directly from markup for data-driven components.

**Browsers:** Chrome, Edge

**Spec:** https://drafts.csswg.org/css-values-5/#attr-notation


#### shape() Function

*Animation · Editor's Draft · Shipped in Chrome 137*

Create complex, responsive clip paths with the shape() function. Supports curves, lines, and CSS custom properties for dynamic clipping that scales with element size.


```css
.blob {
  clip-path: shape(
    from 0% 50%,
    curve to 50% 0% with 0% 0%,
    curve to 100% 50% with 100% 0%,
    curve to 50% 100% with 100% 100%,
    curve to 0% 50% with 0% 100%
  );
}
```

**Use case:** Build complex, responsive clip paths that use percentages and custom properties instead of fixed SVG coordinates. Create blobs, waves, notches, and organic shapes that scale with element size.

**Browsers:** Chrome, Edge

**Spec:** https://drafts.csswg.org/css-shapes-2/#shape-function


#### stretch Sizing Keyword

*Layout · Editor's Draft · Shipped in Baseline 2025*

Make elements fill their containing block with width: stretch or height: stretch. Unlike 100%, it applies to the margin box so margins are respected without calc() hacks.


```css
.full-width {
  width: stretch;
  margin-inline: 24px;
  /* fills container minus margins — 
     no calc(100% - 48px) needed */
}

.full-height {
  height: stretch;
}
```

**Use case:** Make elements fill available space while respecting their margins. Replaces calc(100% - margins) patterns and -webkit-fill-available hacks with a single standardized keyword.

**Browsers:** Chrome, Firefox, Safari, Edge

**Spec:** https://drafts.csswg.org/css-sizing-4/#stretch-fit-sizing


#### corner-shape Property

*Layout · Editor's Draft · Shipped in Chrome 142*

Go beyond border-radius with corner-shape: round, bevel, notch, scoop, or squircle. Create flower shapes, hexagonal grids, and iOS-style squircles in pure CSS.


```css
.squircle {
  border-radius: 24px;
  corner-shape: squircle;
}

.notched {
  border-radius: 16px;
  corner-shape: notch;
}

.scooped {
  border-radius: 40px;
  corner-shape: scoop;
}
```

**Use case:** Create iOS-style squircle icons, beveled card corners, scooped photo frames, and notched UI elements without SVG clip-path hacks.

**Browsers:** Chrome, Edge

**Spec:** https://drafts.csswg.org/css-backgrounds-4/#corner-shape


#### Anchored Container Queries

*Layout · Working Draft · Shipped in Chrome 138*

Style elements based on their anchor positioning fallback. Use @container anchored(fallback: flip-block) to flip tooltip arrows automatically when position changes.


```css
.tooltip {
  position: absolute;
  position-anchor: --trigger;
  position-area: top;
  position-try-fallbacks: flip-block;
}

@container anchored(fallback: flip-block) {
  .tooltip::after {
    /* flip arrow direction */
    transform: rotate(180deg);
  }
}
```

**Use case:** Automatically flip tooltip arrows, dropdown carets, and popover indicators when anchor positioning triggers a fallback. No JavaScript resize or position observers needed.

**Browsers:** Chrome, Edge

**Spec:** https://drafts.csswg.org/css-anchor-position-1/


#### Nested View Transition Groups

*Animation · Working Draft · Shipped in Chrome 136*

Retain 3D and clipping effects during view transitions by nesting ::view-transition-group pseudo-elements. Use view-transition-group: nearest on child elements.


```css
.card {
  view-transition-name: card;
}

.card-image {
  view-transition-name: card-img;
  view-transition-group: nearest;
  /* nests under ::view-transition-group(card) 
     instead of the root group */
}
```

**Use case:** Keep child elements clipped and transformed relative to their parent during view transitions. Cards with images, headers with logos, and nested layouts maintain spatial relationships.

**Browsers:** Chrome, Edge

**Spec:** https://drafts.csswg.org/css-view-transitions-2/#view-transition-group




---

## Resources

Curated links to specifications, tools, learning materials, and community sites. Everything you need to stay current with CSS.


#### Specifications & Standards

- **W3C CSS Working Group** -- The official home of CSS specifications. Drafts, recommendations, and working group news.
  https://www.w3.org/Style/CSS/
- **CSS Snapshot 2025** -- The latest official snapshot of stable CSS specifications ready for implementation.
  https://www.w3.org/TR/css-2025/
- **CSSWG Editor's Drafts** -- Bleeding-edge CSS specifications. See what's being designed before it ships in browsers.
  https://drafts.csswg.org/

#### Browser Support

- **Can I Use** -- Check browser support for any CSS property. The definitive compatibility reference.
  https://caniuse.com/
- **Baseline Dashboard** -- Track which features are available across all major browsers. Part of the web.dev project.
  https://web.dev/baseline
- **Chrome Platform Status** -- Feature tracking for Chrome and Chromium. See what's shipping, in development, or planned.
  https://chromestatus.com/

#### Learning

- **web.dev Learn CSS** -- A comprehensive, free course covering modern CSS from fundamentals to advanced techniques.
  https://web.dev/learn/css
- **MDN CSS Reference** -- The most complete CSS property reference. Detailed docs, examples, and browser compat tables.
  https://developer.mozilla.org/en-US/docs/Web/CSS
- **CSS-Tricks Almanac** -- An encyclopedic guide to every CSS property and selector with practical examples.
  https://css-tricks.com/almanac/
- **Frontend Snippets** -- Frontend-Snippets is 100% free production-ready code snippets for front-end development.
  https://frontend-snippets.com/

#### Tools

- **CSS Validator** -- The official W3C CSS validator. Check your stylesheets for syntax errors and warnings.
  https://jigsaw.w3.org/css-validator/
- **Modern CSS Reset** -- Andy Bell's minimal, modern CSS reset. A sensible starting point for new projects.
  https://piccalil.li/blog/a-more-modern-css-reset/
- **Open Props** -- Sub-atomic CSS custom properties for consistent design tokens. Colors, sizes, easing, and more.
  https://open-props.style/
- **Lightning CSS** -- An extremely fast CSS parser, transformer, and minifier written in Rust. Handles modern syntax.
  https://lightningcss.dev/

#### Community

- **CSS Wrapped 2025** -- Chrome DevRel's annual roundup of CSS features that landed on the web platform.
  https://chrome.dev/css-wrapped-2025/
- **State of CSS Survey** -- Annual survey tracking CSS feature adoption, tools, and developer satisfaction.
  https://stateofcss.com/
- **Interop Dashboard** -- Track cross-browser interoperability efforts. See which features are being aligned across engines.
  https://wpt.fyi/interop