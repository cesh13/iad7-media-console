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

## Make the Windows installer

```bash
npm run dist
```

This makes two files in `dist/`:

- `Media Console Setup 1.0.0.exe` – the installer. It adds a desktop and Start
  menu shortcut. Use this on the church computer.
- `Media Console-1.0.0-portable.exe` – one file that runs without installing
  (for example from a USB stick). It starts more slowly.

Copy the installer to the church computer and run it. Windows shows "Windows
protected your PC" because the app is not signed: click **More info**, then
**Run anyway**. You do this only once: after that the app updates itself.

## Updates

The installed app looks for a new version on
[GitHub Releases](https://github.com/cesh13/iad7-media-console/releases) when
it starts. It downloads it quietly and shows "Version x.y.z is ready" in the
top bar. The update installs when the app closes, so it never stops a service.
Settings, services and Bibles are kept, because they are in the user data
folder, not in the program folder. The portable .exe does not update itself.

To publish a new version, ask Claude Code to "ship" (or "publish an update").
The `ship` skill in `.claude/skills/ship/` raises the version, checks the
code, adds the changes to `CHANGELOG.md`, commits and tags the release
(`v1.2.3`), and runs `npm run release`, which builds the installer and uploads
it to GitHub.

`npm run release` needs a GitHub token in the `GH_TOKEN` environment variable
(once: GitHub → Settings → Developer settings → Fine-grained tokens, only this
repository, Contents: Read and write; then `setx GH_TOKEN "<token>"` and open a
new terminal). The repository must be public, or the app cannot download the
update.

Only one copy of the app can run at a time. Close the dev copy (`npm run dev`)
before you start the installed app on the same computer.

## First setup on the church computer

1. In Windows display settings, choose **Extend** for all screens (not Duplicate).
2. Open the **Screens** tab. Give a name to each output screen (for example
   "Projector", "Participant monitor"). The control monitor needs no name.
   Use **Test all screens** to see which screen is which (Esc closes a test window).
3. In **Groups**: put the projector in **Main** and the participant monitor in
   **Stage** (Stage shows the stage view: clock, countdown, now, next, notes).
   Choose the church logo and what each group shows when nothing is live.
4. **Bible**: click **Download a version…** and download Reina Valera 1909 (or
   other free versions) from the online catalog (getbible.net). This needs internet
   once; after that it works offline. Versions that need a license (RVR1960, NVI, NTV)
   are not in the catalog: import them from a file (Zefania XML, OSIS XML, JSON or text).
5. **PowerPoint**: .pptx files are converted to pictures with Microsoft PowerPoint, if it
   is installed. If not, install LibreOffice (libreoffice.org). Without either, save
   presentations as PDF.
6. **Text style**: in the Bible panel (or the preview of a song) click **Text style…**.
   Choose the font, size, color and background for Bible text and for songs/typed text.
   A song or Bible item can also have its own background picture or video.
7. Optional: watch the shared folder (for example `\\MEDIA-PC\Compartida`),
   add library folders (Library tab), and set hotkeys F1–F8 in Library › ★ Favorites.

## Keys in the Service tab

| Key | Action |
|---|---|
| Space | Next item |
| ← → | Previous / next slide, Bible screen or song stanza |
| ↑ ↓ | Select an item in the order (in the Bible verse list: verse by verse) |
| Enter | Selected item goes live |
| Delete | Remove the selected item from the order (also the × on the row) |
| Esc | Clear the screens of the target |
| F1–F8 | Hotkeys |
| Ctrl+Z | Undo the last change to the order (add, remove, move, copy) |

**+ Text** in the order adds a song, chorus or announcement that you type in the
app. An empty line starts a new screen. The text of a .txt song can be changed in
the preview too (only in this service, not in the file).

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
