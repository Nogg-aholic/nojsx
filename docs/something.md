# SKILLS.md: Adapting Stitch HTML to nojsx NComponents

This guide explains how to convert Stitch-exported HTML into reusable nojsx UI.

The target is not React. The target is nojsx:

- class-based components built on `NComponent`
- TSX compiled with `/** @jsxImportSource nojsx */`
- HTML returned from `html = () => (...)`
- local instance state updated with `this.render()`
- browser-only behavior, not SSR or hydration

If Stitch gives you one large HTML canvas, do not port it 1:1 into a single giant page class. Break it into shell, sections, repeated patterns, and interactive instances.

## 1. nojsx Mental Model

Use these assumptions while converting:

- Each UI unit is usually a class extending `NComponent`.
- Component markup is returned from `html`, not from a React function component.
- Use `class`, not `className`.
- Event handlers are instance class fields, for example `onclick={this.togglePanel}`.
- State lives on `this`, then `this.render()` refreshes the component.
- `children` and named slots are strings/markup passed through props, not React nodes with React semantics.
- Pages live inside a shell layout and route through `NavOutlet` and `getShell().nav(...)` when navigation is needed.

Minimal shape:

```tsx
/** @jsxImportSource nojsx */
import { NComponent } from "nojsx/core/components/components";
import type {} from "nojsx/core/types/index";

export interface PanelProps {
  title?: string;
  class?: string;
  children?: unknown;
}

export class Panel extends NComponent {
  private panelProps: PanelProps;

  constructor(props?: PanelProps) {
    super("Panel", props);
    this.panelProps = props ?? {};
  }

  html = () => {
    const { title, children } = this.panelProps;

    return (
      <section class="rounded-lg border border-stone-200 bg-white p-4">
        {title ? <h2 class="text-sm font-bold">{title}</h2> : ""}
        {children ? <div class="mt-3">{children}</div> : ""}
      </section>
    );
  };
}
```

## 2. First Pass: Split Stitch HTML Into nojsx Targets

When you open a Stitch export, separate the markup into four buckets before writing code.

### A. Shell layout

Anything that looks app-global belongs in a shell page:

- top nav
- sidebar
- main content frame
- footer
- route outlet region

Use `ShellPageParent` for the document shell and `NavOutlet` for page swapping.

### B. Reusable visual primitives

Extract repeated visual blocks into components:

- cards
- section headers
- stat pills
- table rows
- icon buttons
- metric bars

### C. Data-driven sections

Any repeated record list should become props plus a render loop:

- registry rows
- metrics
- action groups
- swatches
- breadcrumbs

### D. Interactive widgets

Anything with state becomes its own `NComponent`:

- accordions
- toggles
- mobile menus
- tab groups
- expandable cards
- counters

Do not leave interaction hidden inside a giant page component if it can be isolated.

## 3. HTML-to-nojsx Translation Rules

These are the most important conversion rules.

### Attribute translation

- `class` stays `class`
- `className` should not be introduced
- `for` becomes `for` only if you are emitting plain HTML attributes; prefer matching nojsx intrinsic usage already present in the codebase
- `onclick` can be a method reference like `onclick={this.handleClick}`
- arbitrary `data-*` attributes are fine
- literal Tailwind classes can remain exactly as Stitch exported them

### Rendering rules

- Return one root element per component when practical.
- Use string fallbacks like `""` for optional blocks.
- Keep markup mostly declarative inside `html = () => (...)`.
- If a block becomes too dense, split it into another `NComponent`.

### Behavior rules

- Define handlers as class fields, not method shorthand.
- Change instance state directly.
- Call `this.render()` after state changes.
- Use `onLoad` and `onUnload` only for browser-side setup or cleanup.

Example interactive conversion:

```tsx
/** @jsxImportSource nojsx */
import { NComponent } from "nojsx/core/components/components";
import type {} from "nojsx/core/types/index";

export class Disclosure extends NComponent {
  open = false;

  constructor(props?: any) {
    super("Disclosure", props);
  }

  toggle = () => {
    this.open = !this.open;
    this.render();
  };

  html = () => (
    <div class="border border-stone-200 rounded-lg overflow-hidden">
      <button type="button" onclick={this.toggle} class="w-full px-4 py-3 text-left font-semibold">
        Toggle section
      </button>
      {this.open ? <div class="px-4 pb-4">Expanded content</div> : ""}
    </div>
  );
}
```

## 4. Preferred Extraction Pattern: Shell + Section + Primitive

For most Stitch exports, the safest nojsx structure is:

1. one shell page
2. one page component per route
3. several reusable section or primitive components

Example split from a large export:

- `ShellPage` for nav/sidebar/document frame
- `DesignSystemPage` for the main canvas
- `SectionHeading` for numbered headings
- `MetricBar` for progress bars
- `StatusPill` for state chips
- `RegistryTable` for table rendering
- `FeatureCard` for large editorial cards

This keeps page markup readable and lets interactive pieces manage their own state.

## 5. Build Components the nojsx Way

### Pattern: compositional wrapper with `children`

Use this when Stitch gives you repeated boxes with different bodies.

```tsx
/** @jsxImportSource nojsx */
import { NComponent } from "nojsx/core/components/components";
import type {} from "nojsx/core/types/index";
import { join } from "nojsx/core/util/util";

export interface CardProps {
  title?: string;
  eyebrow?: string;
  action?: unknown;
  class?: string;
  children?: unknown;
}

export class Card extends NComponent {
  private cardProps: CardProps;

  constructor(props?: CardProps) {
    super("Card", props);
    this.cardProps = props ?? {};
  }

  html = () => {
    const { title, eyebrow, action, children, class: className } = this.cardProps;

    return (
      <div class={join("rounded-lg border border-[#42474F]/15 bg-[#1B1B1B] p-4", className)}>
        {eyebrow || action ? (
          <div class="mb-2 flex items-center justify-between gap-3">
            {eyebrow ? <span class="text-[10px] font-mono uppercase tracking-widest text-[#9ECBFF]">{eyebrow}</span> : ""}
            {action ? <div>{action}</div> : ""}
          </div>
        ) : ""}
        {title ? <h3 class="mb-3 text-sm font-bold text-[#E2E2E2]">{title}</h3> : ""}
        {children}
      </div>
    );
  };
}
```

Use `join(...)` for conditional class assembly instead of pulling in React-style utility conventions by default.

## 6. Named Slots and Structured Stitch Regions

If a component needs more than a single `children` body, use named slots from props.

nojsx supports slot maps via `__slots`, and helpers such as:

- `slotFromProps(props, name)`
- `createSlotGetter(props)`

Use this when Stitch clearly separates regions like:

- header
- sidebar actions
- footer meta
- empty state body
- trailing controls

Example:

```tsx
/** @jsxImportSource nojsx */
import { NComponent } from "nojsx/core/components/components";
import type {} from "nojsx/core/types/index";
import { createSlotGetter } from "nojsx/core/util/slots";

export class FramedPanel extends NComponent {
  private propsRef: any;

  constructor(props?: any) {
    super("FramedPanel", props);
    this.propsRef = props ?? {};
  }

  html = () => {
    const slot = createSlotGetter(this.propsRef);

    return (
      <section class="rounded-xl border border-stone-200 bg-white">
        <header class="border-b border-stone-100 px-4 py-3">{slot("header")}</header>
        <div class="px-4 py-4">{slot("body")}</div>
        <footer class="border-t border-stone-100 px-4 py-3">{slot("footer")}</footer>
      </section>
    );
  };
}
```

Use slots when the exported HTML has clear structural regions. Use `children` when there is only one freeform content area.

## 7. Data-to-Prop Mapping

Do not preserve Stitch HTML as static text if it is obviously data-shaped.

Convert repeated visual states into props.

### Status chips

Map appearance into a semantic prop:

```tsx
export interface StatusPillProps {
  status?: "ok" | "error" | "testing" | "pending";
  label?: string;
}
```

Then derive classes from status instead of duplicating nearly identical HTML blocks.

### Metrics

For bars, counters, quotas, and telemetry, prefer arrays of records:

```ts
type Metric = {
  label: string;
  value: number;
  max?: number;
  tone?: "primary" | "error" | "muted";
};
```

### Tables

Turn each repeated row into data:

```ts
type RegistryRow = {
  nodeId: string;
  status: string;
  payloadType: string;
  throughput: string;
  uptime: string;
};
```

Then render rows from a list instead of pasting four copies of the exported row markup.

## 8. Styling Strategy for Stitch HTML

Stitch exports usually already contain useful Tailwind classes. Keep them unless there is a strong reason to normalize.

Preferred order:

1. keep the exported utility classes during first conversion
2. extract repeated class bundles into reusable component wrappers
3. move recurring color tokens into Tailwind config or shared CSS later

Good candidates for tokenization:

- repeated hex colors
- recurring radius values
- typography scales
- surface/background variants
- subtle border styles

Do not block the port on design-token cleanup. First make the nojsx structure correct.

## 9. Stitch Icons, Fonts, and Embedded HTML Details

Common export details to normalize:

- Material Symbols can remain if the app loads that font.
- Duplicate font imports should be cleaned up.
- Decorative absolute-position layers can stay in page-level components.
- Very large inline demo blocks should become their own components if they distract from page readability.

If the export includes fake code windows, data tables, or terminal snippets, those are usually good component boundaries.

## 10. Page Shell Pattern

When Stitch gives you a full app frame, map it to the nojsx shell model.

Typical split:

```tsx
/** @jsxImportSource nojsx */
import { ShellPageParent } from "nojsx/core/components/shell-page-parent";
import { NavOutlet } from "nojsx/core/components/nav-outlet";
import { AppChrome } from "./components/app-chrome";

export default class ShellPage extends ShellPageParent {
  static layout_title = "My App";

  constructor(props?: any) {
    super({ ...props });
  }

  html = () => (
    <div class="min-h-screen bg-surface text-on-surface">
      <AppChrome />
      <main class="mx-auto max-w-7xl px-6 py-10">
        <NavOutlet />
      </main>
    </div>
  );
}
```

Use `getShell().nav("/route")` inside components that need client navigation.

## 11. When to Keep a Section Static vs Interactive

Keep it static if:

- Stitch only describes presentation
- there is no local UI state
- the section is pure layout/content

Make it interactive if:

- a menu opens or closes
- tabs switch visible panels
- cards expand
- a filter changes visible rows
- a control updates UI state without full page navigation

In nojsx, interactivity is cheap when isolated into a small `NComponent`.

## 12. Common Porting Mistakes

Avoid these:

- writing React function components by habit
- using `className` instead of `class`
- using hooks like `useState` or `useMemo`
- treating nojsx like SSR or hydration
- keeping one 600-line `html` method when the export clearly contains reusable blocks
- duplicating repeated table rows, pills, or cards instead of mapping data to props
- hiding interaction in raw script tags instead of instance methods

Also avoid over-engineering the first pass. Convert structure first, refine token systems second.

## 13. Recommended Conversion Workflow

1. Copy the Stitch export HTML.
2. Mark shell regions, sections, repeated patterns, and interactive widgets.
3. Create a shell page if the export contains app-wide chrome.
4. Convert the main page into a page `NComponent`.
5. Extract repeated cards, rows, pills, and metric blocks into reusable components.
6. Replace duplicated markup with props and arrays.
7. Add stateful handlers only where UI behavior actually exists.
8. Normalize tokens and shared classes after the structure is stable.

## 14. Quick Decision Rules

If you are unsure how to adapt a Stitch block, use these rules:

- repeated and presentational -> reusable wrapper component
- repeated and data-shaped -> prop-driven component
- local UI behavior -> stateful `NComponent`
- app-wide frame -> shell page
- one free content area -> `children`
- multiple named regions -> slots via `__slots`

## 15. Final Checklist

1. [ ] Use `/** @jsxImportSource nojsx */`.
2. [ ] Extend `NComponent` for authored UI pieces.
3. [ ] Use `class`, not `className`.
4. [ ] Keep handlers as class fields with `=`.
5. [ ] Call `this.render()` after local state changes.
6. [ ] Extract repeated Stitch blocks into components.
7. [ ] Convert repeated visual states into semantic props.
8. [ ] Use `children` or slots instead of hardcoding every content region.
9. [ ] Use shell/nav primitives for app-frame and route behavior.
10. [ ] Clean up tokens only after the nojsx structure is correct.
