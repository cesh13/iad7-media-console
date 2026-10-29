# Design mockups

These files are exports of the design canvas "Church Media Console".
They are a visual reference only. Do not copy their code into the app.

The files use a design-tool format (`.dc.html`): HTML with inline styles, a
`<x-dc>` wrapper, `{{value}}` placeholders, `<sc-for>` loops and `<sc-if>`
conditions. The data for the loops is in the `renderVals()` function at the end
of each file. They do not open correctly in a normal browser, because they need
the design tool runtime (`support.js`).

## Files
- `Main.dc.html` — main console: top bar, order + shared folder (left),
  preview (center), screens (right), Bible picker (bottom left),
  hotkeys + Audio / Message / Stage tabs (bottom right).
- `Preview-Video.dc.html` — center preview for a video.
- `Preview-Song.dc.html` — center preview for a song.
- `Preview-Bible.dc.html` — center preview for a Bible reading.
- `Preview-Countdown-Image.dc.html` — center preview for a countdown and an image.
- `Library.dc.html` — Library tab.

## Colors (dark theme)
| Use | Color |
|---|---|
| Page background | `#101215` |
| Panel background | `#16191D` |
| Card / row background | `#1C1F24` |
| Button background | `#1F2328` |
| Border | `#2A2E35` (panels), `#3A3F47` (controls) |
| Text | `#E8E6E1` |
| Secondary text | `#9AA0A8`, `#C9CDD3` |
| Labels (small caps) | `#868D97` |
| LIVE | `#D13438` (background, white text), row tint `#2A1517` |
| PREVIEW / NEXT / selected | `#5BA4FF`, tint `#17263A` |
| Done / OK | `#4CC38A` |
| New / folder / warning | `#E2B35B`, tint `#3A2E14` |

## Type
- UI: IBM Plex Sans, 13 px base.
- Times and numbers: IBM Plex Mono.
- Verse and slide text on screen: IBM Plex Serif (sample).

## Conventions
- Minimum control height 32 px; main actions 36–40 px.
- Section labels: 11 px, uppercase, letter-spacing 0.8 px, `#868D97`.
- LIVE is always red, NEXT and PREVIEW are always blue, done is always green
  with a check.
