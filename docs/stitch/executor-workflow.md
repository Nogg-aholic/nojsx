# Executor Workflow: Stitch Export to nojsx

This document is the execution-side procedure for taking a Stitch `export.html` file and translating it into the nojsx architecture now used in the example app.

Use this together with [docs/stitch/validator-workflow.md](docs/stitch/validator-workflow.md).

The executor and validator are separate roles:

- The executor performs the conversion.
- The validator checks each phase before the executor is allowed to declare completion.

If the validator finds a failure at any phase, stop and correct that phase before continuing.

This workflow is meant to be nested into the main Stitch skill, not merely read as reference.

That means the executor must actively invoke validator checkpoints during execution rather than saving validation for the end.

## 0. First Principle

Do not improvise the workflow.

The recurring failures already documented in [docs/stitch/problems.md](docs/stitch/problems.md) showed that the main source of breakage was not difficulty of implementation. It was instruction drift, structural laziness, premature claims, and self-serving verification.

Because of that, this procedure is intentionally strict and ordered.

## 1. Mandatory Inputs

Before touching app code, the executor must read all of these:

1. [docs/stitch/stitchSkill.md](docs/stitch/stitchSkill.md)
2. [docs/stitch/problems.md](docs/stitch/problems.md)
3. the target Stitch export file, for example [examples/nojsx-app/design/stitch_export.html](examples/nojsx-app/design/stitch_export.html)
4. the current shell file, for example [examples/nojsx-app/src/app.tsx](examples/nojsx-app/src/app.tsx)
5. the target page composition file, for example [examples/nojsx-app/src/pages/home.tsx](examples/nojsx-app/src/pages/home.tsx)
6. [docs/stitch/validator-workflow.md](docs/stitch/validator-workflow.md)

If the user instructed that the skill must be updated first, update the skill before any implementation work.

Before the first code change, the executor must also define the validation checkpoint plan.

Minimum checkpoint plan:

1. checkpoint after shell and head reconciliation
2. checkpoint after structural extraction and placement
3. checkpoint after data extraction and reusable conversion
4. checkpoint before final completion claim

## 2. Non-Negotiables

The executor must not violate any of these:

1. One authored `NComponent` per file.
2. `pages/` are for page composition and route-level assembly only.
3. `app.tsx` keeps shell ownership.
4. `NavOutlet` remains in the shell content region.
5. Do not create fake wrapper shells that replace framework structure.
6. Do not use theme or style names as folder taxonomy.
7. Do not use a flat dump folder for all generated parts.
8. Do not report completion before browser and output verification.
9. If the export requires head assets, use shell head injection first.
10. If CSP blocks the required assets, fix CSP before changing the requested integration mechanism.

## 3. Target Architecture

Translate the export into neutral, responsibility-based structure.

Use categories like these:

1. `components/shell/`
2. `components/sections/`
3. `components/shared/`
4. `pages/`

Within those, organize by responsibility rather than appearance.

Examples:

1. `components/shell/chrome/`
2. `components/shell/navigation/`
3. `components/sections/dashboard/`
4. `components/sections/hero/`
5. `components/sections/tokens/`
6. `components/shared/display/`
7. `components/shared/icons/`
8. `components/shared/model/`

Forbidden examples:

1. `components/midnight-syntax/`
2. `components/dark-theme/`
3. `components/export-paste/`
4. one shallow directory with every generated file in it

## 4. Phase 1: Export Inspection

Do this before deciding file names.

Extract these buckets from the export:

1. shell frame
2. page sections
3. repeated display primitives
4. repeated data-shaped content
5. local interaction points
6. head assets
7. head-local CSS rules
8. design tokens in embedded Tailwind config or style blocks

The executor must produce a written working map before implementation, even if only as temporary notes.

Minimum mapping questions:

1. What belongs in shell chrome?
2. What belongs in page composition?
3. What should become `shared/display`?
4. What should become data arrays or typed records?
5. Which elements rely on fonts or icon stylesheets?
6. Which CSS rules are global rather than component-local?

### Checkpoint A preparation

Before leaving this phase, prepare the first validator prompt inputs:

1. export file
2. shell target file
3. skill document
4. problems ledger
5. validator workflow document

The validator should be asked whether the shell/head plan follows the required approach and avoids known failure modes.

## 5. Phase 2: Shell and Head Reconciliation

Do shell and head integration before detailed component extraction.

### 5.1 Shell ownership

App-wide frame elements belong in [examples/nojsx-app/src/app.tsx](examples/nojsx-app/src/app.tsx), not in a page file.

That includes:

1. top nav
2. sidebar
3. persistent header
4. persistent footer if present
5. main content frame around `NavOutlet`

### 5.2 Head assets

If the export includes fonts or icon stylesheets, place them through `layout_head_html` in the shell.

Do not invent icon abstraction systems first.

Order of operations:

1. map export `<link>` tags into shell head injection
2. map global base styles into app CSS where appropriate
3. preserve export icon names
4. verify whether CSP allows the required hosts
5. if blocked, update CSP
6. only after that verify icon rendering

### 5.3 CSS placement

Use this placement rule:

1. external font or icon stylesheets -> shell head injection
2. reusable global rules -> app CSS
3. component-specific markup styling -> component TSX classes

Do not leave required export head rules behind.

### Required Checkpoint A

Run a validator subagent immediately after shell/head reconciliation.

The validator must check:

1. shell ownership
2. `NavOutlet` placement
3. head asset placement
4. CSP handling strategy
5. whether icons are being integrated through the requested mechanism rather than a workaround

Required validator output format:

1. `PASS` or `FAIL`
2. phase name: `shell-and-head`
3. exact files checked
4. correction instructions if failed
5. whether execution may proceed

If `FAIL`, correct issues before starting structural extraction.

## 6. Phase 3: Structural Extraction

Break the remaining export into authored components.

### 6.1 Page role

The page file composes section components.

The page file should usually do only this:

1. import section components
2. arrange route-level composition
3. keep tiny page-only coordination if absolutely necessary

The page file should not become a dump of authored components.

### 6.2 Section role

Create section components for major semantic blocks.

Examples:

1. hero
2. color and type section
3. controls and actions section
4. registry section
5. feature grid section

### 6.3 Shared role

Create shared components for repeated presentational pieces.

Examples:

1. icon button
2. sidebar link
3. swatch card
4. metric bar
5. status pill
6. registry table
7. registry status
8. feature tile
9. material symbol helper

### 6.4 Model role

Move obviously repeated records into typed data modules.

Examples:

1. top navigation items
2. sidebar items
3. footer links
4. swatches
5. metrics
6. status chips
7. registry rows
8. feature cards

### Required Checkpoint B

Run a validator subagent immediately after the structure is created and imports are wired.

The validator must check:

1. one-file-per-authored-`NComponent`
2. no page-file component dumping
3. no flat dump folders
4. no theme-named taxonomy
5. correct shell/sections/shared placement

Required validator output format:

1. `PASS` or `FAIL`
2. phase name: `structure-and-placement`
3. exact offending files if failed
4. correction instructions if failed
5. whether execution may proceed

If `FAIL`, correct issues before moving to data extraction.

## 7. Phase 4: Data and Props Conversion

Do not keep repeated export HTML as hardcoded duplicated markup when it is obviously data-shaped.

Convert repeated patterns into:

1. typed records in `shared/model/types.ts`
2. arrays in `shared/model/data.ts`
3. prop-driven reusable components

Examples of correct transformations:

1. repeated table rows -> typed row records rendered with `.map(...)`
2. repeated status chips -> semantic tone props
3. repeated swatches -> array-driven cards
4. repeated cards -> data records plus one reusable card component

### Required Checkpoint C

Run a validator subagent after repeated data has been extracted and shared components are wired.

The validator must check:

1. repeated export blocks are not still hardcoded copies
2. semantic props were used where appropriate
3. shared model modules exist where repetition clearly demands them
4. structure still respects the prior checkpoints

Required validator output format:

1. `PASS` or `FAIL`
2. phase name: `data-and-reuse`
3. exact offending files if failed
4. correction instructions if failed
5. whether execution may proceed

If `FAIL`, correct issues before final verification.

## 8. Phase 5: nojsx Translation Rules

Every authored component must follow nojsx conventions.

Required:

1. `/** @jsxImportSource nojsx */`
2. class extending `NComponent`
3. `html = () => (...)`
4. `class`, not `className`
5. class-field handlers for interactions
6. `this.render()` after state changes

Forbidden:

1. React function components by habit
2. hooks like `useState`
3. `className`
4. giant page-level `html` dumps that should be extracted

## 9. Phase 6: Verification During Execution

The executor must verify in phases, not only at the end.

Required sequence:

1. verify head assets and shell rendering
2. verify page composition and routing shape
3. verify section placement
4. verify repeated data rendering
5. verify icons and typography
6. verify browser console cleanliness
7. verify generated output if the build path can differ from source path

Never say any of these before the relevant checks:

1. fixed
2. done
3. resolved
4. complete

### Required Final Checkpoint

Before any final completion claim, run a validator subagent on the finished result.

The validator must check:

1. full phase compliance against [docs/stitch/problems.md](docs/stitch/problems.md)
2. browser/runtime verification status
3. generated-output verification status if build indirection exists
4. remaining anti-patterns from [docs/stitch/validator-workflow.md](docs/stitch/validator-workflow.md)

Required validator output format:

1. `PASS` or `FAIL`
2. phase name: `final-audit`
3. exact offending files if failed
4. correction instructions if failed
5. whether completion may be claimed

## 10. Stop Conditions

The executor must stop and correct immediately if any of these happen:

1. a second authored `NComponent` is about to be added to a file
2. the page file starts accumulating reusable component classes
3. a theme/style name is being used for folder naming
4. a flat bucket is being created for convenience
5. icons are being replaced by a fake mapping layer instead of using export head assets
6. shell ownership is drifting out of `app.tsx`
7. verification has not yet happened but progress is about to be reported as complete
8. the served output does not match the edited source path

## 11. Executor Checklist

Before calling the conversion done, all answers must be yes.

1. Did I read the skill and problems ledger first?
2. Did I preserve shell ownership in `app.tsx`?
3. Did I use head injection for export-required external assets?
4. Did I reconcile CSP before changing the integration approach?
5. Did I avoid theme-as-architecture naming?
6. Did I avoid a flat dump structure?
7. Does every authored `NComponent` live in its own file?
8. Is the page file only composing sections?
9. Did I convert repeated HTML into typed data plus mapped components?
10. Did I verify browser render and generated output before claiming completion?

## 12. Handoff to Validator

When implementation is complete, hand the validator:

1. the export file
2. the changed file tree
3. the final shell file
4. the page file
5. the validator workflow document
6. the problems ledger

Do not narrow the audit scope.
The validator must see the full known failure history.

## 13. Executor Prompt Template For Validator Checkpoints

At each checkpoint, the executor should brief the subagent with this shape:

1. phase name
2. files changed in this phase
3. [docs/stitch/problems.md](docs/stitch/problems.md)
4. [docs/stitch/validator-workflow.md](docs/stitch/validator-workflow.md)
5. exact request: return only `PASS` or `FAIL`, offending files, and correction instructions

Forbidden briefing behavior:

1. omitting the problems ledger
2. reducing the check to a favorable subset
3. asking only whether the latest change "looks good"
4. hiding known structural concerns from the validator