# Church Media Console

Desktop app for the church media team: an ordered service list, a preview,
and output to several screens (projector, participant monitor).
Product decisions are in [docs/SPEC.md](docs/SPEC.md).

## Run

```bash
npm install
npm run dev
```

`npm run build` makes the app in `out/`; `npm start` runs that build.
`npm run typecheck` checks the TypeScript code.

## First setup on the church computer

1. In Windows display settings, choose **Extend** for all screens (not Duplicate).
2. Open the **Screens** tab. Give a name to each output screen (for example
   "Projector", "Participant monitor"). The control monitor needs no name.
   Use **Test all screens** to see which screen is which (Esc closes a test window).
3. In **Groups**: put the projector in **Main** and the participant monitor in
   **Stage** (Stage shows the stage view: clock, countdown, now, next, notes).
   Choose the church logo and what each group shows when nothing is live.
4. **Bible**: import a Bible file (Zefania XML, OSIS XML, JSON or text).
   Use only public-domain versions (RV1909) or versions the church has a license for.
5. **PowerPoint**: install LibreOffice, so .pptx files can be converted to pictures.
   Without it, save presentations as PDF.
6. Optional: watch the shared folder (for example `\\MEDIA-PC\Compartida`),
   add library folders (Library tab), and set hotkeys F1–F8 in Library › ★ Favorites.

## Keys in the Service tab

| Key | Action |
|---|---|
| Space | Next item |
| ← → | Previous / next slide, Bible screen or song stanza |
| ↑ ↓ | Select an item in the order (in the Bible verse list: verse by verse) |
| Enter | Selected item goes live |
| Esc | Clear the screens of the target |
| F1–F8 | Hotkeys |

## Where the data is

Everything is in the user data folder (`%APPDATA%\Media Console` on Windows):

| Path | Content |
|---|---|
| `settings.json` | Screens, groups, logo, audio, library, favorites, saved messages |
| `services\*.json` | One file per service (the order) |
| `media-cache\` | Local copies of all media; PDF pages as pictures. Safe to delete: files are copied again |
| `bibles\` | Imported Bible versions |
| `indexes\` | Search index of folder items (hymnal) |
| `usage.json`, `shared-known.json` | "Last used" in the library; seen files in the shared folder |

## Code

- `src/main/` – the main process. It holds all state (`service.ts`: order and
  live layers per group) and the windows. Output windows only show what it sends.
- `src/renderer/src/control/` – the control window.
- `src/renderer/src/view/` – one screen picture (`ScreenView`), used by the
  output windows, the preview and the small live copies; the stage view.
- `src/renderer/src/output/` – output, test and hidden audio windows.
- `src/renderer/src/strings.ts` – all UI text.
