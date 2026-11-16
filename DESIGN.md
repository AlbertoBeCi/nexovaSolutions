# Design System — Nexova Solutions

## 1. Visual Direction

- **Public Surface (`uis/website`, Mode: Persuade):** *Transatlantic Executive Ledger* — editorial, sober and structured around a 1-section-per-screen rhythm with equal horizontal edges (`max-w-6xl`), warm stone canvas, deep forest green accent (`#1F4E37` / `#68B684`), and serif/sans/mono typographic hierarchy.
- **Internal Surfaces (`uis/backoffice`, `uis/application`, Mode: Operate):** Unified high-clarity operational workspace featuring a distinct neutral sidebar layer (`--sidebar`), tabular numeric alignment (`tabular-nums`) in all tables/metrics, and restrained semantic accents.

---

## 2. Color Tokens

### Public Website (`uis/website/src/app/globals.css`)

| Token | Light Mode | Dark Mode | Role |
| :--- | :--- | :--- | :--- |
| `--bg` | `#f4f3ef` | `#0f1311` | Primary page canvas |
| `--bg-alt` | `#eae7df` | `#171d1a` | Secondary bands & footer |
| `--surface` | `#ffffff` | `#141a17` | Cards, forms & elevated panels |
| `--surface-inverse` | `#14281d` | `#1b2f24` | High-contrast CTA band |
| `--ink` | `#121513` | `#edefe9` | Primary text |
| `--ink-muted` | `#4a524d` | `#a6b0aa` | Secondary text |
| `--ink-placeholder` | `#5c645f` | `#8c9891` | Form placeholders (WCAG AA ≥ 4.6:1) |
| `--accent` | `#1f4e37` | `#68b684` | Primary CTA & active indicators |
| `--line` | `#d2cec4` | `#26302b` | Structural borders & dividers |

### Internal Apps (`uis/backoffice` & `uis/application`)

| Token | Light Mode | Dark Mode | Role |
| :--- | :--- | :--- | :--- |
| `--background` | `#f6f6f3` | `#0f1210` | Main content canvas |
| `--sidebar` | `#ecece6` | `#151917` | Secondary neutral layer for navigation |
| `--surface` | `#ffffff` | `#181d1a` | Cards, tables & panels |
| `--foreground` | `#141715` | `#edefe9` | Primary text |
| `--foreground-muted` | `#525954` | `#a2aba5` | Secondary labels & metadata |
| `--border-subtle` | `#dcdcd4` | `#28302b` | Table & panel borders |
| `--accent` | `#1f4e37` | `#68b684` | Active navigation & primary actions |

---

## 3. Typography

- **Display (Public Website):** `Libre Baskerville` (`--font-libre-baskerville`, `400`, `700`)
- **UI & Body (All 3 apps):** `Public Sans` (`--font-public-sans`)
- **Technical / Tabular Data (All 3 apps):** `JetBrains Mono` (`--font-jetbrains-mono`)

---

## 4. Motion & Accessibility

- **Motion (`uis/website`):** Hero entrance (`[data-enter]`), 2px card hover lift (`.card-lift`), and tactile button press (`.btn-tactile`), all disabled under `@media (prefers-reduced-motion: reduce)`.
- **Accessibility:** `color-scheme: light dark` declared in `<head>` and `:root`, skip-to-content link, `min-h-11` (44px) touch targets on controls, and literal validation/error messages per `CONTEXT.md`.
