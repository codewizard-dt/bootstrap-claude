# Design Principles

## Frontend Taste — House Style

Calm, technical, light-mode editorial — a *tool*, not a consumer app. Clarity over decoration.

The canonical source is `~/code/house-style`; a snapshot lives in `raw/house-style/` here. Wire it into any new frontend project:

1. **Tailwind preset** — `presets: [houseStyle]` in `tailwind.config`, importing `raw/house-style/tokens/tailwind.preset.ts`.
2. **Base layer** — apply `raw/house-style/preview/src/index.css`: `bg-canvas text-ink antialiased`, body `letter-spacing:-0.011em`, `font-feature-settings:"ss01","cv11","cv02"`, plus the `dot-grid` / `text-balance` / `scrollbar-none` utilities and `::selection` tint.
3. **Font** — load **Inter Tight** (fallback: Inter, then system-ui).
4. **Components** — copy `raw/house-style/components/*.tsx` as starting patterns; each is props-driven and content-agnostic with all hover/press/focus/selected states preserved.
5. **Visual reference** — `~/code/house-style/preview/` (`cd preview && npm i && npm run dev`).

### Aesthetic rules

- **Neutral ground, ink on off-white.** Canvas `#f6f7f9`, white cards, near-black ink (`#0b0b0d`). Color is reserved for meaning (interactive affordances, semantic state), never decoration.
- **Soft depth, no gloss.** 14 px radii, 1 px hairline borders (`#e7e8ea`), whisper-soft shadows. Gradients and dark surfaces appear only where a feature demands them.
- **Technical type.** Inter Tight, globally tight tracking (`-0.011em`), stylistic sets on. Uppercase micro-labels get *expanded* tracking (`~0.08em`); monospace for codes and IDs. Type scale: display ~15 px/600; uppercase labels 10–12 px/600; body 13–13.5 px leading-relaxed; button 13 px/500; caption/mono 11 px.
- **Motion that clarifies, not entertains.** Snappy entrances (`popIn` 220 ms), gentle rises (`riseIn` 500 ms), all on `cubic-bezier(.22,1,.36,1)`. Press-scale on interactive elements (`active:scale-[.985]`). No long delays.
- **Restraint.** The default accent is muted blue-gray (`#4f5a78`) — focus rings and subtle affordances, not loud primaries.

### Token quick-reference

| Group | Values |
|---|---|
| Surfaces | `canvas #f6f7f9` · `surface #f1f2f4` · `paper/card #fff` |
| Ink | `ink #0b0b0d` · `ink-2 #33353b` · `muted #6b6e76` · `muted-2 #9a9da5` |
| Lines | `line #e7e8ea` · `line-2 #f0f1f3` |
| Accent | `#4f5a78` (neutral) · `red #e5484d` · `green #30a46c` · `blue #3b6ef6` |
| Radius | `card 14 px` · `pill 999 px` |
| Motion | `fadeIn` `riseIn` `popIn` `revealIn` `travel` `shimmer` `breathe` `spinSlow` `drawIn` `bounceSoft` |

### Component inventory

- **`Button`** — primary dark CTA; optional leading icon gets a hover tilt-and-grow.
- **`IconButton`** — icon + label, `variant` (primary/secondary), `iconMotion` (tilt | spin3d), `loading` spinner swap.
- **`Chip`** — pill that lifts on hover; `tone` (neutral/highlight) + optional status dot.
- **`Stepper`** — horizontal progress indicator with orbiting spinner, self-drawing checkmark, and a travelling dot on the in-flight connector rail.
- **`Card` · `Badge` · `Modal`** — surfaces, pill labels, blurred pop-in overlay.
- **`icons.tsx`** — inline-SVG icon set (no icon dependency): spark, image, cube, bolt, diamond, expand, chevron, draw-in check, spinner, x.

---

## DRY — Don't Repeat Yourself

Every piece of knowledge should have a single, authoritative representation in the system. When logic, data, or behavior appears in more than one place, changes require updates everywhere — and they rarely stay in sync.

In practice: extract shared logic into a function or module; avoid copy-pasting code blocks; centralise configuration rather than scattering literals. The goal is one source of truth, not necessarily the fewest lines.

## SOLID

Five principles for writing object-oriented (and more broadly, modular) code that stays maintainable as it grows:

- **Single Responsibility** — a class or module should have one reason to change. If it handles both business logic and persistence, those two concerns will pull it in different directions over time.
- **Open/Closed** — code should be open for extension but closed for modification. Add new behaviour by adding new code, not by editing existing, tested paths.
- **Liskov Substitution** — subtypes must be substitutable for their base types without breaking callers. A subclass that weakens guarantees or surprises callers violates this.
- **Interface Segregation** — prefer narrow, focused interfaces over broad ones. Callers shouldn't depend on methods they don't use.
- **Dependency Inversion** — depend on abstractions, not concretions. High-level modules shouldn't be coupled to low-level implementation details; both should depend on interfaces.

## YAGNI — You Aren't Gonna Need It

Don't build something until you actually need it. Speculative features add complexity, require maintenance, and often turn out to be wrong by the time a real requirement arrives.

In practice: implement the simplest thing that solves the current problem. Resist the urge to add extension points, configuration flags, or abstractions "just in case." If the need materialises later, add it then — with full context.
