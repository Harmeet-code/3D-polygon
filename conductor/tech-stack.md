# Technology Stack

## Language & Runtime

- **Language:** JavaScript (ECMAScript modules, `"type": "module"` in package.json)
- **Runtime:** Bun v1.3.13
- **Type System:** TypeScript via JSDoc annotations and `checkJs: true` in tsconfig (`strict: true`, `noUncheckedIndexedAccess: true`)

## 3D Rendering

- **Three.js v0.160.0** — loaded via CDN (unpkg.com) through importmap in `index.html`
- **OrbitControls** (`three/addons/controls/OrbitControls.js`) — camera manipulation
- **No bundler** — vanilla ES modules, tested via `checkJs` type checking

## Frontend

- No framework (vanilla HTML/CSS/JS)
- Dark theme with CSS custom properties
- Glassmorphism UI (semi-transparent panels with backdrop-filter blur)

## Developer Tooling

| Tool            | Purpose                                                        | Command                 |
| --------------- | -------------------------------------------------------------- | ----------------------- |
| **Oxlint**      | Linting                                                        | `bun lint`              |
| **Oxfmt**       | Formatting (single quotes, no trailing commas, 100 char width) | `bun format`            |
| **tsc**         | Type checking                                                  | `bun typecheck`         |
| **Husky**       | Git hooks                                                      | Automatic on prepare    |
| **commitlint**  | Conventional commit enforcement                                | Automatic on commit-msg |
| **lint-staged** | Pre-commit formatting + linting                                | Automatic on pre-commit |

## Package Manager

- **Bun** — installs dependencies, runs scripts
- Dev server: `bunx http-server src -p 3000 -c-1 -o`

## Data Format

- JSON files for booth geometry and metadata (fabric/CAD coordinates)
- JPEG images for floor plan textures
- Coordinate pipeline: Fabric → Pixel → World (Three.js scene space)

## Code Style Conventions

- Single quotes
- Semicolons required
- No trailing commas
- Arrow functions for callbacks
- for-of loops preferred
- No `class`/`this` except Three.js API calls
- JSDoc parenthesized casts instead of TypeScript `!` assertions
