# Kivest Status — Design Spec

## Typography

### Font Families

| Token | Value | Fallback |
|-------|-------|----------|
| `--sans` | `'Inter'` | `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif` |
| `--serif` | `'Instrument Serif'` | `Georgia, 'Times New Roman', serif` |

### Font Weights

| Weight | Usage |
|--------|-------|
| 400 | Body text, hero subtitle, serif headings |
| 500 | Labels, nav links, badges, filter buttons |
| 600 | Nav brand, section titles (sans), footer brand |
| 700 | Hero title, stat numbers |

### Font Sizes

| Usage | Size |
|-------|------|
| Base | `16px` |
| Hero title (desktop) | `3rem` (48px) |
| Hero title (tablet) | `2.25rem` (36px) |
| Hero title (mobile) | `1.75rem` (28px) |
| Hero subtitle | `1.125rem` (18px) |
| Section title | `2rem` (32px) |
| Stat number | `2.5rem` (40px) |
| Nav brand | `0.9375rem` (15px) |
| Nav links, filter tabs | `0.8125rem` (13px) |
| Body / card meta | `0.8125rem` (13px) |
| Badges, uptime labels | `0.6875rem` (11px) |
| Loading text, stat label | `0.6875rem` (11px) |
| Live indicator, footer note | `0.75rem` (12px) |

### Letter Spacing

| Usage | Value |
|-------|-------|
| Hero title, stat numbers | `-0.04em` |
| Section title, nav brand | `-0.02em` |
| Model name | `-0.01em` |
| Stat label, loading text | `+0.10–0.12em` (uppercase) |

### Line Height

| Usage | Value |
|-------|-------|
| Hero title | `1.1` |
| Stat number | `1.1` |
| Hero subtitle | `1.6` |
| Body default | `1.5` |

---

## Colors

All colors are defined as CSS custom properties in `:root` (light theme).

### Backgrounds

| Token | Hex | Usage |
|-------|-----|-------|
| `--bg` | `#fafafa` | Page background, loading screen |
| `--bg-section` | `#f4f4f5` | Models section, icon backgrounds |
| `--bg-card` | `#ffffff` | Model cards, filter tabs, filter buttons |
| `--bg-card-hover` | `#fafafa` | Card hover state |
| `--bg-input` | `#ffffff` | Search input |

### Borders

| Token | Hex | Usage |
|-------|-----|-------|
| `--border` | `#e4e4e7` | Default borders |
| `--border-hover` | `#d4d4d8` | Hover borders |

### Text

| Token | Hex | Usage |
|-------|-----|-------|
| `--text` | `#09090b` | Primary text |
| `--text-secondary` | `#27272a` | Secondary text |
| `--text-muted` | `#71717a` | Muted / subtitles |
| `--text-dim` | `#a1a1aa` | Dimmed / timestamps, labels |

### Accent (Indigo)

| Token | Value | Usage |
|-------|-------|-------|
| `--accent` | `#6366f1` | Links, active states, spinner, italic title |
| `--accent-hover` | `#4f46e5` | Accent hover |
| `--accent-light` | `rgba(99, 102, 241, 0.06)` | Accent tinted backgrounds |
| `--accent-border` | `rgba(99, 102, 241, 0.20)` | Accent tinted borders |

### Status: Green (Online / Operational)

| Token | Value | Usage |
|-------|-------|-------|
| `--green` | `#16a34a` | Text, dots, bars |
| `--green-light` | `rgba(22, 163, 74, 0.06)` | Badge / pill backgrounds |
| `--green-border` | `rgba(22, 163, 74, 0.20)` | Badge / pill borders |

### Status: Red (Offline / Down)

| Token | Value | Usage |
|-------|-------|-------|
| `--red` | `#dc2626` | Text, dots, bars |
| `--red-light` | `rgba(220, 38, 38, 0.06)` | Badge / pill backgrounds |
| `--red-border` | `rgba(220, 38, 38, 0.20)` | Badge / pill borders |

### Status: Amber (Paid Only / Degraded)

| Token | Value | Usage |
|-------|-------|-------|
| `--amber` | `#d97706` | Text, dots, bars |
| `--amber-light` | `rgba(217, 119, 6, 0.06)` | Badge / pill backgrounds |
| `--amber-border` | `rgba(217, 119, 6, 0.20)` | Badge / pill borders |

### Status: Purple (Reasoning)

| Token | Value | Usage |
|-------|-------|-------|
| `--purple` | `#7c3aed` | Text, dots |
| `--purple-light` | `rgba(124, 58, 237, 0.06)` | Badge / pill backgrounds |
| `--purple-border` | `rgba(124, 58, 237, 0.20)` | Badge / pill borders |

### Special

| Token | Value | Usage |
|-------|-------|-------|
| `--nav-bg` | `rgba(250, 250, 250, 0.80)` | Sticky nav background (base) |
| `--uptime-empty` | `rgba(0, 0, 0, 0.04)` | Unknown uptime segment |
| `--uptime-bar-bg` | `rgba(0, 0, 0, 0.06)` | Uptime bar track |

---

## Shadows & Glows

| Token | Value | Usage |
|-------|-------|-------|
| `--shadow-card` | `0 1px 3px rgba(0,0,0,0.06), 0 0 0 1px var(--border)` | Default card shadow |
| `--shadow-card-hover` | `0 8px 32px rgba(0,0,0,0.08), 0 0 0 1px var(--border-hover)` | Hovered card shadow |
| `--glow-green` | `0 0 24px rgba(22,163,74,0.10)` | Operational system status glow |
| `--glow-red` | `0 0 24px rgba(220,38,38,0.10)` | Outage system status glow |

---

## Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius` | `14px` | Model cards |
| `--radius-sm` | `10px` | Filter tabs, search input |
| `--radius-xs` | `6px` | Nav links, small elements |
| `999px` | — | Pills / badges, filter status buttons, uptime bars |
| `16px` | — | Nav inner container |
| `8px` | — | Model icon |

---

## Breakpoints

| Breakpoint | Value | Changes |
|------------|-------|---------|
| Tablet | `≤ 768px` | Smaller hero title, stacked section header, single-column grid |
| Mobile | `≤ 480px` | Smaller hero title, hidden nav links, smaller stats |
