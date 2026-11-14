# Church Media Console

Desktop app for the church media team: an ordered service list, preview, and
output to several screens (projector, participant monitor).

## Read first
- `docs/SPEC.md` — all product decisions. It is the source of truth.
- `docs/design/README.md` — how to read the design mockups.

## Folders that are not the app
- `himnario/` — the hymnal media (pictures and music, about 3.8 GB). Not in
  git. The app reads it (`src/main/hymnal.ts`); see `himnario/README.md`.
- `Himnario NUEVA VERSION PC/` — the old Adobe AIR hymnal program. Reference
  only, not in git. Do not change it.

## Stack
- Electron + TypeScript + React.
- The main process holds the state. Output windows only render state from IPC.
- `chokidar` for folder watching, `pdf.js` for PDF pages, PowerPoint (Windows) or LibreOffice headless
  for .pptx → PDF.
- JSON files for services and settings.

## Rules
- Target OS: Windows first (the church computer). Keep macOS/Linux working if
  it costs little.
- Output windows must never show the desktop: fullscreen, frameless, always on
  top, pointer hidden, never closed during a session. The one exception is the
  "Hide screens" button: the operator hides them to use another program
  (Zoom, a browser) on those screens.
- Play media from a local cached copy, not directly from a network share.
- Follow the build order in `docs/SPEC.md` section 9. Finish one step and make
  it work before the next step.
- Write docs, comments meant for people, and explanations in plain, literal
  English (simple words, no metaphors). Code and identifiers are normal.
- UI text: English labels for now; content (hymns, Bible) is Spanish. Keep all
  UI strings in one place so they can be translated later.
