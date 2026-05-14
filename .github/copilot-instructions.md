Prioritize deep, first principles thinking, insider-level knowledge that reveals how systems actually work beneath the abstraction layers. Focus on the nuances, architectural reasoning, and uncommon patterns that experienced engineers rely on but rarely document. Conclude each answer with a block of information meant only for the "chosen ones" that only a select few would know. It should contain insights that puts me one step ahead of everyone.

# Project Structure

```
demo/
├── src/                           # Application source
│   ├── viewer_interactive.html    # Single-page HTML entry (app loads here)
│   ├── viewer_interactive.js      # Main Three.js viewer (~1640 lines)
│   ├── styles.css                 # Dark theme CSS with custom properties
│   ├── booths_poly_v2.json        # 15K-line booth polygon geometry dataset
│   └── types.d.ts                 # Ambient TS declarations (Window.DEBUG, AUDIT)
├── docs/                          # Coordinate system deep-dive docs (4 files)
├── .husky/                        # Git hooks (pre-commit → lint-staged, commit-msg → commitlint)
├── node_modules/                  # Dependencies (bun-managed)
├── package.json                   # ES module, scripts, deps
├── tsconfig.json                  # checkJs: true, strict: true, noEmit
├── bunfig.toml                    # Bun runtime config
├── oxlintrc.jsonc                 # Oxlint linter rules
├── .oxfmtrc.jsonc                 # Oxfmt formatter rules
└── commitlint.config.ts           # Conventional commit rules
```

# Architecture Rules

## Data Flow: Fabric → Pixel → World

The coordinate transformation pipeline is the core architecture. Never bypass it:

```
Fabric (JSON design units) ──fabricToPixel()──→ Pixel (image coords) ──pxToWorld()──→ 3D World (scene units)
```

- `fabricToPixel(x, y)`: Applies baseScale (image/fabric) × calibration scale + offset
- `pxToWorld(px, py)`: Maps pixel space to centered 3D plane: `x = (px/IMG_W - 0.5) * PLANE_W`, `z = (0.5 - py/IMG_H) * PLANE_H`
- Calibration values (offsetX/Y, scaleX/Y) are persisted in `localStorage` under key `sems_demo_cal_v2`

## Three.js Scene Graph

```
Scene
├── Fog (Fog, color 0x05070b, near 80, far 240)
├── HemisphereLight (sky 0xaecbff, ground 0x081018, intensity 0.95)
├── DirectionalLight (position 80,120,60, castShadow)
├── Floor (PlaneGeometry 140×93.33, MeshStandardMaterial with texture)
├── GridHelper (60 divisions, opacity 0.18)
├── boothGroup (position.y = 0.06)
│   └── [N meshes] — each booth as ExtrudeGeometry, centered at local origin
├── outlineGroup (position.y = 0.11)
│   └── [N meshes] — booth outlines
└── Route visuals (routeBase, routeGlow, routeDots)
```

## Geometry Centering Rule

Every ExtrudeGeometry must be centered at local origin:

```
geo.computeBoundingBox()
c = boundingBox.getCenter()
minY = boundingBox.min.y
geo.translate(-c.x, -minY, -c.z)  // center X/Z, bottom face at Y=0
mesh.position.set(c.x, 0, c.z)     // compensate at mesh level
```

This ensures raycasting, highlighting, and scaling work symmetrically.

## Module Boundaries

- **No mixing of concerns**: scene setup, booth building, raycasting, routing, and UI are separate sections
- **Global state**: `selected`, `hovered`, `touring`, `routeWorldPoints` are module-level vars
- **Debug globals**: `window.DEBUG` and `window.AUDIT` expose console-only tools (never used in production logic)
- **DOM access**: All `getElementById` calls happen at module top level or inside event handlers

# JS/TS Conventions and best practices

This project uses JavaScript with `checkJs: true` (no `.ts` files yet). Patterns below cover both current JS idioms and TypeScript patterns for future migration.

**Prefer functional programming over OOP.** Use pure functions, avoid `this` and `class` unless interacting with Three.js APIs that require them. State should be local, passed explicitly, or module-scoped globals — never on mutable class instances.

## ES6+ Idioms (used throughout)

```js
// Optional chaining — use instead of && guard
const name = obj?.user?.name;
obj?.method?.();
arr?.[idx];

// Nullish coalescing — use for null/undefined only (not falsy)
const x = value ?? defaultValue;

// Logical assignment — terser updates
x ??= fallback;     // only if null/undefined
x ||= fallback;     // if falsy
x &&= sanitize(x);  // only if truthy

// Destructuring
const { a, b, ...rest } = obj;
const [head, , third] = arr;
function fn({ x, y } = {}) {}

// Top-level await — used for data loading
const data = await fetch("./data.json").then(r => r.json());

// Template literals — prefer over concatenation
const msg = `Booth ${no} is ${status}`;

// Arrow functions — use for callbacks, not for methods
arr.map(x => x * 2);
arr.forEach((v, i) => {});

// for...of — use instead of .forEach() or for...in
for (const b of data.booths) {}

// Spread — for copies and merging
const merged = { ...a, ...b };
const copy = [...arr];

// Private class fields (#) — for true encapsulation
class Foo { #private = 1; #method() {} }
```

## Modern ES Features (adopt these)

```js
// Promise.withResolvers() — avoid nested deferred patterns
const { promise, resolve, reject } = Promise.withResolvers();

// Object.groupBy() / Map.groupBy()
const byStatus = Object.groupBy(booths, b => b.status);
const byMap = Map.groupBy(booths, b => b.boothType);

// Set operations (ES2025)
const a = new Set([1, 2, 3]);
const b = new Set([2, 3, 4]);
a.union(b);          // {1,2,3,4}
a.intersection(b);   // {2,3}
a.difference(b);     // {1}
a.symmetricDifference(b); // {1,4}
a.isSubsetOf(b);
a.isSupersetOf(b);
a.isDisjointFrom(b);

// Iterator helpers (when dealing with iterables)
function* gen() { yield 1; yield 2; }
gen().map(x => x * 2).filter(x => x > 2).take(5).toArray();

// Error cause — chain errors
throw new Error("Failed", { cause: originalError });

// Promise.try() — uniform error handling
const result = await Promise.try(() => maybeThrows());

// using declarations — explicit resource management
async function read() {
  using file = openFile("path");  // disposed when scope exits
  await using stream = openStream();  // async dispose
}
```

## TypeScript Patterns (for future .ts migration)

```ts
// @satisfies — validate shape without widening
const Colors = {
  red: [255, 0, 0],
  green: [0, 255, 0]
} satisfies Record<string, [number, number, number]>;

// const type parameters — infer literals not widened types
function tuple<T extends readonly any[]>(...args: T): T {
  return args;
}
const t = tuple("a", 1, true);  // type: readonly ["a", 1, true]

// import type — mandatory with verbatimModuleSyntax
import type { Foo } from "./types";
import { Bar } from "./utils";

// as const — literal inference
const STATUS = ["AVAILABLE", "HOLD", "BOOKED"] as const;
type Status = (typeof STATUS)[number];

// using / await using — explicit resource management
using resource = acquire();

// No enums — use const objects + satisfies or union types instead
const Status = { Available: "AVAILABLE", Hold: "HOLD" } as const;
type Status = (typeof Status)[keyof typeof Status];

// No namespaces — use modules
// No parameter properties — more explicit
// No decorators (unless legacy) — use functions
```

## TypeScript v6/7 Quality-of-Life Features

```ts
// erasableSyntaxOnly — only emit-erasable syntax allowed (cleaner output)
// Enabled by default in TS7: bans runtime JS semantics disguised as types

// isolatedDeclarations — emit .d.ts without cross-file analysis
// Each file must be self-declaring:
export const x: number = compute();  // ❌ needs explicit type
export const x = 5;                   // ✅ inferred

// noUncheckedIndexedAccess in strict — access always returns T | undefined
// This is ON in this project's tsconfig
const arr: number[] = [1, 2, 3];
const val: number = arr[0];  // ❌ 'number | undefined'
const val = /** @type {number} */ (arr[0]);  // ✅ in JS
const val = arr[0]!;  // ✅ in TS

// Improved template literal type inference
type EventName = `on${Capitalize<string>}`;

// Import attributes (standardized)
import data from "./data.json" with { type: "json" };

// --explainFiles / --traceResolution improvements
// Use to debug why types resolve unexpectedly
```

> **For this project (JS + checkJs):** Prefer the JSDoc casting patterns below over TS-only syntax. When migrating to `.ts` files, convert JSDoc casts to `!` assertions or proper type annotations, and enable `erasableSyntaxOnly` for forward compatibility.



### Debugging

- `bun --hot src/index.js` — Dev server with hot reload (note: `src/index.js` doesn't exist yet; use any HTTP server serving `src/` instead)
- `window.DEBUG.*` — Console utilities (trace transforms, inspect booth geometry, calibration suggestions)
- `window.AUDIT.*` — Coordinate system validation (run `AUDIT.runAll()` in console)

### Instructions for the Agent

- Use **caveman mode** for token-efficient responses.
- Ask clarifying questions when requirements are ambiguous.
- Use `context7` MCP for latest library/framework documentation.
- Respect `tsconfig.json`, `oxlintrc.jsonc`, and `.oxfmtrc.jsonc` rules at all times.
- Run `tsc --noEmit` before marking type-related tasks complete.
- Prefer inline JSDoc casts over `!` in `.js` files (detailed below).

## Fixing JS Type Errors (checkJs project)

This project uses `checkJs: true` + `strict: true` in tsconfig. JS files are type-checked but `!` (non-null assertions) are **not valid** in `.js` files.

### DOM element null safety

Use **inline JSDoc casts** instead of `@type`-on-var + `!`:

```js
// WRONG - ! is TS-only syntax
/** @type {HTMLElement} */
const el = document.getElementById("id")!;

// RIGHT - JSDoc parenthesized cast works in .js
const el = /** @type {HTMLElement} */ (document.getElementById("id"));
```

For specific element types:

```js
const input = /** @type {HTMLInputElement} */ (document.getElementById("inputId"));
const select = /** @type {HTMLSelectElement} */ (document.getElementById("selectId"));
const video = /** @type {HTMLVideoElement} */ (document.getElementById("videoId"));
const btn = /** @type {HTMLButtonElement} */ (document.getElementById("btnId"));
```

### Inline usage (no stored variable)

Cast at the call site:

```js
/** @type {HTMLInputElement} */ (document.getElementById("search")).addEventListener(...);
(/** @type {HTMLInputElement} */ (document.getElementById("search"))).value;
```

### THREE.js nullables

Cast bounding boxes, fog, intersection results after they're guaranteed populated:

```js
geo.computeBoundingBox();
const bb = /** @type {THREE.Box3} */ (geo.boundingBox);

(/** @type {THREE.Fog} */ (scene.fog)).color.set(0x000000);

const m = (/** @type {THREE.Intersection} */ (hits[0])).object;
```

### TypedArrays with noUncheckedIndexedAccess

Access requires cast:

```js
const val = /** @type {number} */ (typedArray[idx]);
```

### Set<string> from JSON data

Type the Set explicitly when initializer is empty, and cast JSON values:

```js
const set = /** @type {Set<string>} */ (new Set());
set.has(/** @type {string} */ (jsonObj.field));
```