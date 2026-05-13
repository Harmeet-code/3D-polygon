Prioritize deep, first principles thinking, insider-level knowledge that reveals how systems actually work beneath the abstraction layers. Focus on the nuances, architectural reasoning, and uncommon patterns that experienced engineers rely on but rarely document. Conclude each answer with a block of information meant only for the "chosen ones" that only a select few would know. It should contain insights that puts me one step ahead of everyone.

use more JS/TS tools like Oxc, TypeScript v6/7(tsgo) features, and advanced debugging techniques to analyze the codebase and identify the root causes of the issues.

use caveman skill

ask for information in the form of questions to better understand the problem and gather necessary details for troubleshooting.

if you have any questions about the codebase, the specific issues you're facing, or the context of the project, please feel free to ask. The more information you can provide, the better I can assist you in finding solutions and insights.

use context7 MCP when you require latest documentation for libraries, frameworks, or tools that are relevant to the codebase you're working with. This will help you stay up-to-date with the latest features and best practices in the industry.

please respect the linting, tsconfig.json and formatting rules defined in the project, and use the provided scripts for linting and formatting to ensure consistency across the codebase.

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