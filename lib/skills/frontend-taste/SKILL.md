---
name: frontend-taste
description: Wire the house-style design system into the current project — copies tokens/tailwind.preset.ts + tokens.json, components/*.tsx patterns, and the base CSS layer from ~/code/house-style; wires the Tailwind preset and Inter Tight font; matches the calm technical editorial aesthetic described in ~/code/house-style/README.md. Use when starting any new frontend feature, UI component, or screen that should match the design language.
category: executing
model: claude-sonnet-5
---

# Frontend Taste

This skill wires the house-style design system into the current project.
Source: `~/code/house-style` — a portable UI kit extracted from a production app.
Run this once per project when you first need UI components; after that, extend in-place.

## Design language (read first)

**Calm, technical, light-mode editorial — a tool, not a consumer app. Clarity over decoration.**

- **Surfaces:** Off-white canvas `#f6f7f9`, white cards, near-black ink `#0b0b0d`. Color = meaning only (interactive affordances, semantic state), never decoration.
- **Depth:** 14px radii, 1px hairline borders `#e7e8ea`, whisper-soft shadows. No gloss, no dark surfaces unless a feature demands them.
- **Type:** Inter Tight globally, `-0.011em` tracking, stylistic sets `ss01 cv11 cv02` on. Uppercase micro-labels with `~0.08em` expanded tracking; monospace for codes/IDs.
- **Motion:** Snappy entrances (`popIn` 220ms), gentle rises (`riseIn` 500ms), bouncy ease `cubic-bezier(.22,1,.36,1)`. Press-scale `active:scale-[0.985]` on buttons. No long delays.
- **Accent:** Muted blue-gray `#4f5a78` — shows up in focus rings, not as a loud primary.

Type scale: display ~`15px/600`; uppercase labels `10–12px/600` + `tracking-[0.08em]`; body `13–13.5px` leading-relaxed; button `13px/500`; caption/mono `11px`.

## Steps

### 1. Read the visual reference

Before writing any UI, read `~/code/house-style/README.md` for the full design language description. The `preview/` directory is the live visual reference — run `cd ~/code/house-style/preview && npm i && npm run dev` to see the full kit.

### 2. Copy tokens

Copy these two files into the project under `src/styles/` (or wherever the project keeps design tokens — check for an existing `tokens/` or `styles/` directory first):

- `~/code/house-style/tokens/tailwind.preset.ts` → `<project>/src/styles/tailwind.preset.ts`
- `~/code/house-style/tokens/tokens.json` → `<project>/src/styles/tokens.json`

The preset imports `tokens.json` with a relative path (`./tokens.json`) — preserve that relationship.

### 3. Wire the Tailwind preset

Find the project's Tailwind config (`tailwind.config.ts` / `tailwind.config.js` / `tailwind.config.cjs`).
Add the preset import and register it:

```ts
import houseStyle from "./src/styles/tailwind.preset";

export default {
  presets: [houseStyle],
  // ... rest of config
};
```

If the project already has `theme.extend` entries, they remain — `presets` adds tokens on top of the default theme without clobbering existing overrides.

### 4. Apply the base CSS layer

Find the project's global CSS entry point (typically `src/index.css`, `src/globals.css`, `app/globals.css`, or wherever `@tailwind base` lives).

Add this block after the `@tailwind` directives:

```css
@layer base {
  html {
    @apply bg-canvas text-ink antialiased;
    font-feature-settings: "ss01", "cv11", "cv02";
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
  body {
    font-family: "Inter Tight", "Inter", ui-sans-serif, system-ui, sans-serif;
    letter-spacing: -0.011em;
  }
  ::selection {
    background: rgba(79, 90, 120, 0.18);
  }
}

@layer utilities {
  .scrollbar-none {
    scrollbar-width: none;
  }
  .scrollbar-none::-webkit-scrollbar {
    display: none;
  }
  .text-balance {
    text-wrap: balance;
  }
  .dot-grid {
    background-image: radial-gradient(circle, rgba(11, 11, 13, 0.05) 1px, transparent 1.4px);
    background-size: 22px 22px;
    -webkit-mask-image: radial-gradient(120% 100% at 50% 0%, #000 35%, transparent 95%);
    mask-image: radial-gradient(120% 100% at 50% 0%, #000 35%, transparent 95%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .animate-travel,
  .animate-shimmer,
  .animate-breathe,
  .animate-spinSlow {
    animation: none !important;
  }
}
```

If the base layer block already exists, merge — don't duplicate the `@layer base` wrapper.

### 5. Load Inter Tight

**Next.js (app router):** In `app/layout.tsx`:
```tsx
import { Inter_Tight } from "next/font/google";
const interTight = Inter_Tight({ subsets: ["latin"], variable: "--font-inter-tight" });
// Apply: <body className={interTight.className}>
```

**Vite / other:** Add to `index.html` `<head>`:
```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600&display=swap" rel="stylesheet" />
```

Or via CSS `@import` at the top of the global stylesheet:
```css
@import url('https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600&display=swap');
```

### 6. Copy component patterns

Copy these files from `~/code/house-style/components/` into the project's components directory (e.g. `src/components/ui/`). They are source patterns — copy and extend freely; each project's copy diverges; the house-style stays canonical.

| File | What it is |
|---|---|
| `Button.tsx` | Primary dark CTA; optional leading icon tilts+grows on hover |
| `IconButton.tsx` | Icon + label, `variant` (primary/secondary), `iconMotion` (tilt/spin3d), `loading` spinner swap |
| `Chip.tsx` | Pill that lifts on hover, presses on click; `tone` (neutral/highlight) + status dot |
| `Card.tsx` | White card surface; `padded`, `bare` props |
| `Badge.tsx` | Compact pill label with hover state |
| `Modal.tsx` | Blurred backdrop overlay with pop-in content |
| `Stepper.tsx` | Horizontal progress indicator: pending→active→done nodes, traveling dot connector |
| `icons.tsx` | Inline-SVG icon set (Sparkles, Spinner, Image, Cube, Bolt, Diamond, Expand, ChevronDown, X, Check) |

Adjust import paths in each file to match the project's path aliases.

### 7. Verify

After wiring, confirm:
- `bg-canvas`, `text-ink`, `border-line`, `rounded-card`, `shadow-card`, `animate-popIn` resolve without Tailwind unknown-class warnings
- Body text renders in Inter Tight at tight tracking
- A `<Button>` from the copied component renders dark with press-scale on click

## Tokens reference

| Token | Value |
|---|---|
| `canvas` | `#f6f7f9` |
| `surface` | `#f1f2f4` |
| `paper` / `card` | `#ffffff` |
| `ink` | `#0b0b0d` |
| `ink-2` | `#33353b` |
| `muted` | `#6b6e76` |
| `muted-2` | `#9a9da5` |
| `line` | `#e7e8ea` |
| `line-2` | `#f0f1f3` |
| `accent` | `#4f5a78` |
| `accent-red` | `#e5484d` |
| `accent-green` | `#30a46c` |
| `accent-blue` | `#3b6ef6` |
| `accent-amber` | `#e0901a` |
| `accent-violet` | `#8b5cf6` |
| `radius-card` | `14px` |
| `radius-pill` | `999px` |

Animations: `fadeIn` `riseIn` `popIn` `revealIn` `travel` `shimmer` `breathe` `spinSlow` `drawIn` `bounceSoft` — all keyed on `cubic-bezier(0.22,1,0.36,1)`.

## Notes

- This is a **copy-from** source, not an npm dependency. Each project owns its copy.
- The house-style itself lives at `~/code/house-style` — never modify it from a target project.
- `preview/` in the source kit is the live visual reference for every component and animation.
- For the component patterns, extend rather than fight the base styles — `className` prop pass-through is already wired on every component.
