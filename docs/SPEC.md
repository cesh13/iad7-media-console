# Church Media Console — Specification (v0.1)

This file records the decisions from the design session (October 2026).
The design mockups are in `docs/design/`. Read `docs/design/README.md` first.

## 1. Goal

A free, simple desktop app for the church media team. It replaces the current
work method: a folder of files in order, PowerPoint, a video player, and
BibleShow, used one after the other.

The app must:
- Show an ordered list of items for one service (videos, slides, songs, Bible,
  images, countdowns).
- Send each item to one or more screens.
- Show a preview before an item goes live.
- Never show the Windows desktop on a screen during the service.

Non-goals for v1: song database with chords, live streaming, cloud sync, mobile
remote control.

## 2. Hardware and screens

The church computer has 3 screens:
- **Control monitor (back):** the app window. No output goes here.
- **Projector:** output group "Main".
- **Participant monitor (front):** output group "Stage".

Today Windows "duplicates" the projector and the participant monitor. With this
app, Windows must "extend" to all 3 screens. The app does the duplicate when it
is necessary (put both screens in the same group).

Requirements:
- Detect screens with Electron `screen` API. Listen for `display-added`,
  `display-removed`, `display-metrics-changed`.
- Save each screen assignment by display label + resolution + position, not
  only by id. Show a warning if a saved screen is missing.
- Each output content must scale to the resolution of its screen.
- Output windows: frameless, fullscreen, always on top, mouse pointer hidden.
  They stay open for the full session.

## 3. Stack

- Electron + TypeScript + React (renderer).
- One main process holds the full state. Output windows only render the state
  they receive over IPC.
- Media: HTML `<video>`, `<img>`, `<audio>`.
- PDF pages: `pdf.js` (or pre-render to PNG).
- PowerPoint: convert .pptx to PDF, then show it as PDF pages. On Windows use
  Microsoft PowerPoint when it is installed (through PowerShell, without a
  window). Otherwise use LibreOffice in headless mode
  (`soffice --headless --convert-to pdf`). Do not try
  to render .pptx directly. Animations and embedded video in .pptx are not
  supported; the team plays those parts as separate video files.
- Folder watching: `chokidar`.
- Storage: JSON files for services and settings. SQLite (or a JSON index) for
  the search index of large folders (hymns, Bible).

## 4. Data model (first version)

```ts
type ItemType = 'video' | 'slides' | 'song' | 'bible' | 'image' | 'audio' | 'countdown' | 'folder';

interface Output {        // one physical screen
  id: string;
  displayKey: string;     // label + resolution + position
  name: string;           // "Projector", "Participant monitor"
}

interface Group {
  id: string;
  name: string;           // "Main", "Stage", "Lobby"
  outputIds: string[];
  idle: 'logo' | 'background' | 'black' | 'loop';   // shown when nothing is live
  idleMediaPath?: string;
  live?: LiveState;       // current item, slide/verse index, play state
  layers: { background?: string; content?: string; text?: string; audio?: string };
}

interface ServiceItem {
  id: string;
  type: ItemType;
  title: string;
  path?: string;          // source file (original)
  localCopyPath?: string; // cached copy used for playback
  section?: string;       // "Before service", "Culto"
  notes?: string;
  status: 'pending' | 'live' | 'done';
  settings: Record<string, unknown>;  // per type, see section 6
  folderChoice?: string;  // for type 'folder': chosen file inside the folder
}

interface Service {
  id: string;
  name: string;           // "Culto Divino · Sáb 31 Oct"
  date: string;
  sourceFolder?: string;
  items: ServiceItem[];
}
```

## 5. Main screen layout

See `docs/design/Main.dc.html`. Dark theme (dim room).

### 5.1 Top bar
- Left: Service / Screens tabs. Center: app name. Right: clock and elapsed
  time, the "No output screen" chip when it applies, and the buttons.
- Buttons: **Logo**, **Clear text**, **Black screen (all)**.

### 5.2 Left panel: Order / Library / Bible tabs

**Order tab**
- Items grouped by section. Each row: status, type icon, title, length or count.
- Status: done (check, gray, strike-through), LIVE (red), NEXT (blue).
- Progress bar "4 of 10 done".
- An item is marked done automatically when it ends (setting per item), or by
  the "Mark done" button.
- Drop files or folders to add them. Default order is by file name (01, 02…).

**Folder items in the order (for example the hymnal, 613 files)**
- The folder row opens in place.
- It has a search input and a list with a fixed height (about 168 px) that
  scrolls inside.
- Search by number (a number alone puts that item first), by title, and by
  words in the lyrics. Ignore accents and case
  (`str.normalize('NFD').replace(/[̀-ͯ]/g, '')`).
- Build the search index once when the folder is added; update it when the
  folder changes. For .pptx, extract the text during conversion.
- ↑ ↓ move in the list, Enter chooses. The chosen file is saved in
  `folderChoice`. When a service is copied, the folder stays and the choice is
  cleared.

**Shared folder section (after the "Culto" section)**
- Watches a network folder, for example `\\MEDIA-PC\Compartida`.
- Shows files and subfolders. New items have a dot and a "N NEW" count.
- Subfolders open in place (option 1) and have an **All** button that adds all
  their files to the order in file-name order (option 2).
- Status per file: copying / converting (with progress) / ready / in order.
- Rules:
  - `chokidar` with `usePolling: true` for network folders, `awaitWriteFinish`,
    and a `depth` limit (3).
  - A folder is "ready" only when no file inside it changed for a few seconds.
  - Ignore `Thumbs.db`, `desktop.ini`, `.DS_Store`, files that start with `~$`.
  - Copy each file to a local cache before playback.
  - Start .pptx → PDF conversion immediately.
  - Rename/move = delete + new. Do not remove items already in the order.
- The source computer name is not reliable from a share. Do not depend on it.

**Library tab** — see `docs/design/Library.dc.html`
- Library root folders (Himnario, Videos, Fondos, Anuncios, Música de fondo,
  Compartida) and past services.
- Path bar, type filters, sort, file tiles (type, length, last used).
- Details panel: Add to order, Open in preview, Add to Favorites.
- "Reuse a past service": copy its order to the current service.
- "★ Favorites" is a library folder. It replaces the old Bookmarks panel.

### 5.3 Center: Preview
- Shows the selected item. Nothing goes on screens until **Go live**.
- "Send to" selector: a group or all screens.
- Keys: ← → slides, Space next item, Esc clear.
- Item notes and options (auto-mark done, loop, auto-advance).
- Layout changes by item type, see section 6.

### 5.4 Right: Screens
- One card per group with small live copies of its screens.
- Layer clear buttons per group (Background, Text, Audio).
- Stage card shows: now, next, clock, notes.
- New screens appear at the bottom with "add to a group".
- When no output screen is connected, a yellow box at the top says "Nothing
  goes to a screen", tells why (none set up, or none connected) and has a button
  to open the Screens tab. The top bar also shows a "No output screen" chip.
- "Edit groups" opens the group settings (screens per group, idle screen).

### 5.5 Bible tab
- A third tab next to Order and Library. Like Library, it uses the left column
  (search, version, picker, "Today" chips, Text style / Download / Import) and
  the center (location bar, Add to order, Show now, verse list). The Live panel
  and the Screens column stay visible.
- **Ctrl+B** opens the tab and puts the cursor in the search input, from
  anywhere.
- The Bible state (passage, selection, search) stays the same when the operator
  switches tabs.
- The Live panel row of live text has ‹ › buttons (same as ← →), so the
  operator can move verse by verse from the Order tab too.
- Search input: "jn 3 16", "sal 23:1-4", or words. Spanish short book names.
- Version selector. Use only public-domain or licensed versions (RV1909 is
  public domain).
- Location bar: "Libros › Salmos › 23 › 1", with previous/next chapter buttons.
  Each part is clickable and goes back to that step.
- "Today" chips: references already used in this service.
- **Picker in one area with a fixed height (300 px)**, one step at a time:
  1. Libro: 66 books, AT and NT, colored by type (Ley, Historia, Poesía,
     Profetas, Evangelios, Cartas y Apocalipsis).
  2. Capítulo: chapter numbers of the selected book.
  3. Versículo: verse numbers. Shift+click selects a range.
  - Books with 1 chapter go directly to the verse step.
- Search and picker share one state.
- Verse list on the right with LIVE and NEXT marks. ↑ ↓ move verse by verse.
- Buttons: Add to order, Show now.

### 5.6 Bottom: Hotkeys + Audio / Message / Stage tabs
- **One slim bar (about 44 px), always visible.** From left to right:
  the loaded service (selector, rename ✎, + New), hotkeys, music summary,
  and the Audio / Message / Stage buttons.
- A button opens its **drawer** above the bar (max 300 px, closed by default).
  A second click closes it. The drawer pushes the content up; it never covers
  the Live panel or the preview. Esc does not close it (Esc clears the screens).
- A **red dot** on Message or Stage while something from that tab is on a
  screen (a lower-third message; a stage message or a running countdown).
- **Hotkeys:** F1–F8 (logo, prayer background, offering video…). One press =
  live now. Only keys with a favorite show, as small chips. "+" opens
  Library › ★ Favorites, where hotkeys are edited.
- **Music summary:** play/pause, track name, time, **Fade out 3 s**,
  background volume.
- **Audio tab:**
  - Background music player (playlist, shuffle, now playing, time bar).
  - Previous, pause, next, **Fade out 3 s**.
  - Separate volume: background music and video/items.
  - Output level meter (L/R).
  - Output device selector (`setSinkId`).
  - Auto duck: lower background music when a video plays.
  - Start background music after the last item.
- **Message tab:** lower-third text (name and role, urgent notice). Saved
  messages. Choose target group.
- **Stage tab:** messages only for the Stage screen ("5 min", "Wrap up", "Video
  ready", free text). Participant countdown controls (see 7).

## 6. Preview by item type

See `docs/design/Preview-*.dc.html`.

- **Video:** player, time bar with start/end points and cue markers, −10 s,
  +10 s, jump to cue, volume. When it ends: go to next item / go to idle screen
  (default) / black / hold last frame / loop. Audio output device, fade in/out,
  stop background music.
- **Song:** verse order chips (drag, repeat, skip; chorus support), verse
  thumbnails, background (video loop), text size and position, max lines,
  optional instrumental track.
- **Bible:** verse on screen with reference; long verses split into screens with
  "…"; verses per screen; reference position; version name; full screen or
  lower third; optional second version.
- **Countdown:** duration or until a clock time; text above; action at 0:00;
  also show on Stage.
- **Image:** Fit / Fill (crop) / Blur sides; background; auto next after N s;
  rotate by EXIF.
- **Slides (PDF from .pptx):** page view, page thumbnails, prev/next.

## 7. Stage screen (participant monitor)

- Large clock.
- Participant countdown: for example "Sermón 30:00". Yellow at 5 min, red at 0,
  then counts up ("+2:15").
- Current item and next item.
- Messages from the Stage tab.
- Controlled from the Stage tab: start, pause, reset, set time.

## 8. Idle screen (instead of the desktop wallpaper)

- Output windows never close during the service.
- When nothing is live, each group shows its idle screen:
  Main → logo or background; Lobby → announcements loop; Stage → clock + next.
- Set per group in "Edit groups".
- Default "when it ends" action for items: go to idle screen.

## 9. Build order

1. Electron app: list screens, open a test fullscreen window on each one,
   save screen assignments.
2. Service order with video and image items; next / previous; Go live to one
   group.
3. Groups (Main, Stage) with different content; idle screen.
4. Preview panel with "Go live".
5. PDF slides with `pdf.js`; .pptx → PDF conversion with PowerPoint or LibreOffice.
6. Bible: data import, search, picker.
7. Folder items with search (hymnal); search index.
8. Shared folder watching.
9. Audio panel (background music, fade, duck, device).
10. Stage screen: clock, countdown, messages.
11. Library tab, Favorites, hotkeys, past services.

## 10. Open questions

- Which Bible versions does the church have a license for?
- Hymn source: .pptx files, text files, or both? Real numbering?
- Does the graphics card drive 3 separate (extended) screens? Test once.
- Is a Lobby screen needed (screen 4)?
