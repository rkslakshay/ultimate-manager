# Design system

Tokens are defined once in [`apps/web/src/styles/index.css`](../apps/web/src/styles/index.css)
(Tailwind v4 `@theme`) and used through Tailwind utilities (`bg-surface`, `text-fg-muted`,
`border-border`, …). Never hard-code hex colours in components. A live reference lives in the
app: account menu → **UI kit** (`/game/:saveId/ui-kit`).

## Colour

| Token                                                  | Use                                                    |
| ------------------------------------------------------ | ------------------------------------------------------ |
| `bg`                                                   | Page background                                        |
| `surface`, `surface-2`, `surface-3`                    | Cards/panels → table headers/inputs → chips            |
| `surface-hover`                                        | Row and item hover                                     |
| `border`, `border-strong`                              | Dividers; inputs, menus, modals                        |
| `fg`, `fg-muted`, `fg-subtle`                          | Primary text; labels/secondary; hints/captions         |
| `accent` (+ `-hover`, `-fg`)                           | **Solid fills only** (primary buttons) with white text |
| `accent-text`, `ring`                                  | Accent-coloured text, links, icons; focus ring         |
| `accent-muted`                                         | Active nav item / accent badge background              |
| `success` / `warning` / `danger` / `info` (+ `-muted`) | Status text / tinted backgrounds                       |
| `danger-solid` (+ `-hover`)                            | Filled destructive buttons with white text             |
| `attr-1` … `attr-5`                                    | Player attribute values (see below)                    |

All text/background pairs used in components were measured to meet WCAG AA (≥ 4.5:1). Rule
of thumb: never put `text-accent` on a dark surface (3.7:1) — use `text-accent-text`; hover
states on filled buttons get _darker_ so white text keeps its contrast.

**Attribute ramp (1–20):** 1–5 `attr-1` (red), 6–9 `attr-2` (orange), 10–12 `attr-3` (yellow),
13–15 `attr-4` (green), 16–20 `attr-5` (teal). Use `attributeClass(value)` from `lib/utils`.

## Typography

- Font: Inter Variable (bundled via `@fontsource-variable`), system fallback.
- Base size **13px** (`text-sm`) for a dense, data-heavy UI. `text-xs` 12px for labels,
  `text-2xs` 11px for table headers, badges and captions (uppercase + tracking).
- Numbers in tables use tabular figures automatically (`table`, or the `.tabular` class).
- Headings: page `text-lg font-semibold`; card titles `CardTitle` (11–12px uppercase muted).

## Spacing, radius, layout

- Tailwind's 4px scale. Common: `gap-2`/`gap-3` inside components, `gap-4`/`gap-5` between cards,
  `p-4` card content, `px-2.5` table cells, 32px (`h-8`) default control and row height.
- Radii: `rounded-sm` 4px (badges), `rounded-md` 6px (controls), `rounded-lg` 8px (cards/modals).
- Shell: sidebar `--sidebar-width` 216px (52px collapsed), top bar `--topbar-height` 52px.

## Components (`apps/web/src/components/ui`)

| Component                     | Notes                                                                                                                                                                        |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Button`                      | Variants `primary/secondary/outline/ghost/danger/success/link`; sizes `sm/md/lg/icon/icon-sm`; `loading`; `asChild` for links                                                |
| `Card`                        | `CardHeader`, `CardTitle`, `CardContent`, `CardFooter`                                                                                                                       |
| `DataTable`                   | TanStack Table: sorting (with `aria-sort`), quick filter, column picker, client pagination, loading skeleton, empty state, row click. `meta.align` / `meta.label` per column |
| `Tabs`                        | Radix tabs, underline style                                                                                                                                                  |
| `Dialog`                      | Radix modal; requires `title`, optional `description`; `DialogFooter`                                                                                                        |
| `DropdownMenu`                | Items, checkbox items, labels, separators                                                                                                                                    |
| `Input`, `Label`, `FormField` | `FormField` wires label, error (`role=alert`) and hint with ARIA                                                                                                             |
| `Badge`, `Kbd`                | Status chips (`tone`), keyboard hints                                                                                                                                        |
| `Skeleton`                    | Loading placeholders (preferred over spinners)                                                                                                                               |

## Principles

1. Dense but legible: information first, chrome second.
2. Skeletons, not spinners; optimistic updates for local mutations (see saves rename/delete).
3. Every interactive element is keyboard reachable with a visible focus ring.
4. Respect `prefers-reduced-motion` (handled globally).
