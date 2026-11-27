# UI audit

Captured with `AUDIT=1 npx playwright test` (tests/visual/screenshots.spec.ts): 21 pages × 3 roles + public pages at
1440 / 768 / 375 px (light; dark after theming). Screenshots are written to `ui-audit/` (git-ignored).
Automated checks (re-run after Phase 4, all passing): axe WCAG 2.1 AA on 15 pages in **both light and dark** (30 tests), no horizontal
overflow at 375/768/1366, zero console errors, keyboard focus order starts at the skip link.

Status: ✅ fixed in Phase 4 · ⏳ partially · ⛔ not done (see "Remaining")

## P0 — breaks trust or blocks a judging criterion
| # | Issue | Where | Status |
|---|---|---|---|
| 1 | No dark / system theme; app forced light | global | ✅ next-themes (Light/Dark/System, persisted, no flash) |
| 2 | 5.3 innovation barely visible: single Online/Offline pill, no "Unstable"/"Reconnecting", no restore screen, no disruption timeline | exam workspace | ✅ pill Online / Unstable / Reconnecting / Offline, per-answer “Saved to server / Saved on this device” state, offline banner, “Attempt restored — no time was added” dialog driven by server resume detection, server-recorded connection & recovery log |
| 3 | Monitoring mixes connectivity events with integrity indicators | examiner monitoring | ✅ split streams + "Indicators are not evidence of misconduct" |
| 4 | Logout only inside the avatar menu; no visible account card | all roles | ✅ sidebar user card with Sign out |

## P1 — looks template-like or inconsistent
| # | Issue | Where | Status |
|---|---|---|---|
| 5 | Stat cards: sub-lines wrap awkwardly, unequal heights, one card without a sub-line | dashboards | ✅ one StatCard (tone icon chip, label, number, required sub-line, equal heights) |
| 6 | 4 stat cards stack to ~700 px on mobile | dashboards @375 | ✅ 2-column grid on mobile |
| 7 | Activity chart is a thin line, no area, weak legend | admin overview | ✅ gradient area chart |
| 8 | No breadcrumbs, no command palette, no theme toggle, no notifications in the top bar | all roles | ✅ breadcrumbs, Ctrl+K command palette (pages, theme, sign out), theme toggle, notifications popover (role-aware feed) |
| 9 | Sidebar not grouped or collapsible | all roles | ✅ grouped sections, collapsible (persisted) with tooltips |
| 10 | Candidate dashboard has no "next exam" focus or performance trend | candidate | ✅ countdown card + trend chart |
| 11 | Empty states without a call to action | several | ✅ CTA buttons on key empty states |
| 12 | Workspace navigator states only by colour | exam workspace | ✅ filled vs outlined + bookmark icon (flagged) + cloud icon (not yet synced) + current ring, all in aria-labels |
| 13 | No keyboard shortcuts / help in the workspace | exam workspace | ✅ N / P / 1–9 / F shortcuts (paused while typing) + "?" help dialog |

## P2 — polish
| # | Issue | Status |
|---|---|---|
| 14 | No skip link | ✅ |
| 15 | Touch targets < 44 px on coarse pointers | ✅ min 44 px for buttons/inputs on touch devices |
| 16 | No subtle motion | ⏳ hover lift on stat cards, sidebar width transition, timer colour transition; number count-up **not** added |
| 17 | Times flash "UTC" before hydration | ⏳ by design (server renders UTC, client switches to local) |
| 18 | Tables lack column sorting | ⏳ search + filters + pagination on users and question bank; sorting not added |
| 19 | Radix Select renders an empty trigger before hydration | ⏳ library behaviour, values appear after hydration |

## Also done in Phase 4
- Workspace timer box turns amber at 5 min and red at 1 min (background + border, not colour alone: screen-reader announcements at both thresholds).
- Dark palette (navy) with a dedicated `--warning-text` token so amber text passes AA in both themes.
- `<main id="main">` on every page so the skip link always has a target.

## Remaining
- Count-up animation on stat numbers (#16), column sorting (#18).
- Lighthouse scores are measured in Phase 6 (QA_REPORT.md).
