# Validator Workflow: Anti-Patterns, Breakage Checks, and Phase Gates

This document is the validation-side procedure for auditing a Stitch export conversion.

Use this together with [docs/stitch/executor-workflow.md](docs/stitch/executor-workflow.md).

The validator is not a cheerleader. The validator is there to catch drift, shortcuts, false completion claims, and structural damage as early as possible.

The validator must also read [docs/stitch/problems.md](docs/stitch/problems.md) before validating.

This workflow is designed to be invoked multiple times during execution, not only once at the end.

The validator should expect checkpoint-style audits after major phases.

## 0. Validation Standard

The validator should assume that the executor may have unintentionally drifted into one of the already-known failure modes.

Do not validate only what the executor chose to highlight.

The validator must inspect for:

1. stated success criteria
2. unstated regressions
3. previously documented anti-patterns
4. mismatches between source edits and actually served output

## 1. Phase Gate Model

Each phase must pass before the next phase is considered valid.

The phases are:

1. instruction alignment
2. taxonomy and file structure
3. shell and routing
4. head assets and CSP
5. component extraction and placement
6. data extraction and repetition handling
7. nojsx correctness
8. runtime and browser verification
9. final fidelity and completion claims

The validator should return a hard gate result at each checkpoint:

1. `PASS`
2. `FAIL`

If `FAIL`, the executor must not continue to the next phase.

## 2. Phase 1: Instruction Alignment

The validator checks whether the executor followed the requested order and scope.

Questions:

1. Was the skill updated first if requested?
2. Did the executor read and incorporate the problems ledger?
3. Did the executor stay on the requested path rather than substituting a preferred path?
4. Did the executor avoid acting outside the requested scope?

Fail if:

1. implementation started before required guidance updates
2. the executor drifted from the requested approach
3. the executor changed topic while a concrete requested fix remained unresolved
4. the validator was handed a narrowed audit frame instead of the full relevant context

Validator response requirements:

1. say `PASS` or `FAIL` first
2. identify the phase being checked
3. name the exact missing context if the executor narrowed the scope
4. state whether execution must stop

## 3. Phase 2: Taxonomy and File Structure

This phase checks whether the structure itself is correct.

Required positive conditions:

1. folders are responsibility-based and neutral
2. there is no theme/style-named architecture bucket
3. there is no flat dump structure
4. each authored `NComponent` is in its own file
5. `pages/` contain page composition only

Immediate failures:

1. a directory named after a visual style or theme, such as `midnight-syntax`
2. one shallow component bucket containing everything
3. files like `primitives.tsx`, `sections.tsx`, or any other multi-component dump file
4. authored components living inside page files

Validator commands/checks:

1. inspect the full component tree
2. scan for multiple `export class ... extends NComponent` occurrences per file
3. inspect page files for authored component definitions

Checkpoint use:

- this phase is the core of the `structure-and-placement` checkpoint

## 4. Phase 3: Shell and Routing

This phase checks whether framework responsibilities were preserved.

Required positive conditions:

1. [examples/nojsx-app/src/app.tsx](examples/nojsx-app/src/app.tsx) remains the shell owner
2. `NavOutlet` remains in the shell content region
3. app-wide header/sidebar/frame live in the shell, not in route pages

Immediate failures:

1. shell logic moved into a page file
2. a fake wrapper or chrome abstraction replacing shell semantics
3. `NavOutlet` hidden behind an unnecessary wrapper layer

## 5. Phase 4: Head Assets and CSP

This phase checks whether the export’s asset model was reconciled correctly.

Required positive conditions:

1. export-required external font and icon links are wired through shell head injection
2. required global CSS rules were migrated deliberately
3. CSP allows those assets if they are required
4. icon names from the export remain intact when the export depends on a font-based icon system

Immediate failures:

1. fake icon mapping layer introduced instead of using export assets
2. alternate icon system substituted without instruction
3. CSP issue worked around by changing approach instead of fixing CSP first
4. head-local export rules only partially migrated

Validator checks:

1. inspect `layout_head_html`
2. inspect browser console for CSP violations
3. compare rendered icons against export expectation
4. inspect generated output when build indirection exists

Checkpoint use:

- this phase is the core of the `shell-and-head` checkpoint

## 6. Phase 5: Component Extraction and Placement

This phase checks whether the decomposition matches the architecture.

Required positive conditions:

1. page file imports and composes sections
2. sections own semantically large blocks
3. shared components own repeated display patterns
4. shell parts live under shell folders
5. shared data and types live in neutral shared model modules

Immediate failures:

1. page file contains reusable authored component classes
2. section files bundle unrelated authored components together
3. shared files are acting as catch-all dumps
4. shell parts are mixed into pages or section folders

Checkpoint use:

- this phase is also part of the `structure-and-placement` checkpoint

## 7. Phase 6: Data Extraction and Repetition Handling

This phase checks whether repeated export markup was translated into data and props rather than copied repeatedly.

Required positive conditions:

1. repeated visual patterns are driven from arrays or typed records
2. variant styling is represented semantically through props or derived class logic
3. tables, chips, swatches, nav lists, and cards are not manually duplicated when clearly repeated

Immediate failures:

1. repeated rows hardcoded as repeated markup
2. repeated cards hardcoded as repeated markup
3. identical blocks copied instead of mapped
4. color/status differences represented only by copy-pasted HTML variants

Checkpoint use:

- this phase is the core of the `data-and-reuse` checkpoint

## 8. Phase 7: nojsx Correctness

This phase checks whether the implementation actually follows nojsx conventions.

Required positive conditions:

1. `/** @jsxImportSource nojsx */` is present where needed
2. authored UI pieces extend `NComponent`
3. `html = () => (...)` is used
4. `class` is used instead of `className`
5. handlers are class fields when interaction exists
6. `this.render()` follows state changes

Immediate failures:

1. React hooks
2. `className`
3. React-style function component habits
4. browser-invalid imports not guaranteed by runtime mapping

## 9. Phase 8: Runtime and Browser Verification

This phase prevents false completion claims.

Required positive conditions:

1. browser render was actually checked
2. browser console was actually checked
3. generated or served output was checked when source-to-output indirection exists
4. the executor did not report completion before those checks

Immediate failures:

1. “fixed” claimed before runtime verification
2. source edited but served output still stale
3. console still shows CSP or import resolution issues
4. the rendered app still diverges from the export in obvious ways

Checkpoint use:

- this phase is mandatory in the `final-audit` checkpoint

## 10. Phase 9: Final Fidelity Audit

This phase compares the final app against the export.

Required positive conditions:

1. shell frame matches the export’s overall structure
2. major sections appear in the right order
3. typography and icon systems match
4. repeated data-driven blocks match the intended design
5. no obvious missing or invented UI blocks remain

Immediate failures:

1. invented layout changes not required by nojsx
2. omitted export sections
3. substituted visuals that were easier to implement but not faithful
4. visual mismatch dismissed as “close enough” without user approval

## 11. Red-Flag Heuristics

Any of these should trigger deeper inspection:

1. a folder name describes the style rather than the responsibility
2. a page file is growing unusually large
3. filenames like `primitives`, `sections`, `misc`, `helpers`, or `components` are collecting many authored UI classes
4. icons are broken and the executor starts talking about alternate icon systems
5. progress claims appear before the browser has been checked
6. the audit brief sounds too narrow or self-serving

## 12. Forbidden Patterns

These are automatic fails unless the user explicitly requested them:

1. theme-as-architecture naming
2. flat dump folders
3. one-file multi-`NComponent` dumps
4. shell replacement wrappers
5. fake icon mapping systems replacing export assets
6. browser-invalid imports
7. premature “done” reporting
8. partial audit framing that hides known problems from the checker

## 13. Validator Checklist

Before approving, every answer must be yes.

1. Did I validate against the problems ledger, not just the executor summary?
2. Is the file taxonomy neutral and responsibility-based?
3. Is there exactly one authored `NComponent` per file?
4. Is shell ownership preserved in `app.tsx`?
5. Is `NavOutlet` in the correct shell region?
6. Were export-required head assets integrated through the correct mechanism?
7. Was CSP corrected if required?
8. Were repeated structures translated into shared components and typed data?
9. Does the runtime render cleanly with no obvious console breakage?
10. Did the executor avoid claiming success before real verification?

## 14. Validator Output Format

The validator should report phase-by-phase:

1. pass or fail
2. exact offending files if failed
3. the specific anti-pattern triggered
4. whether the executor must stop before continuing

The validator must not soften findings to protect the executor.

Required normalized output shape:

1. `PASS` or `FAIL`
2. checkpoint name
3. files checked
4. offending files if any
5. concise correction instructions if failed
6. `MAY PROCEED` or `STOP AND CORRECT`

## 15. Checkpoint Mapping

Use these checkpoint names consistently:

1. `shell-and-head`
2. `structure-and-placement`
3. `data-and-reuse`
4. `final-audit`

Expected validator emphasis by checkpoint:

### `shell-and-head`

Primary concerns:

1. shell ownership
2. `NavOutlet` placement
3. head injection usage
4. CSP strategy
5. icon integration correctness

### `structure-and-placement`

Primary concerns:

1. taxonomy neutrality
2. one-file-per-authored-`NComponent`
3. no flat dump structure
4. page purity
5. section/shared/shell placement correctness

### `data-and-reuse`

Primary concerns:

1. repeated markup converted into data and props
2. semantic props for repeated states
3. no duplicated hardcoded repeated blocks
4. no regression to catch-all shared files

### `final-audit`

Primary concerns:

1. all prior phase expectations still hold
2. browser/runtime verification actually happened
3. generated-output verification happened if required
4. no unresolved known anti-patterns remain