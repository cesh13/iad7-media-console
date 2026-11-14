# Changes

## 2.0.1 – 2026-11-14

- Updates now come from the church's GitHub: github.com/iglesia-adventista-miramonte/iad7-media-console. Computers with version 1.5.0 or older update to this version by themselves, like any other update; no installer is needed. After that they update from the new place.
- This version has everything from version 2.0.0: the Hymnal tab (Ctrl+4, or Ctrl+H to search), where a hymn's music starts when it goes live and the slides follow the music, and the "Hide screens" button in the top bar, which shows the Windows desktop on the output screens (for Zoom, a browser or another program) while items stay live.
- It also has everything from version 1.5.0: the presenter clicker that works when another program is in front (Setup tab), and the Stage / Full screen switch on the Stage card.

## 2.0.0 – 2026-11-14

- This version has all changes of version 1.5.0 (below), and adds the Hymnal tab and the "Hide screens" button.
- New Hymnal tab (Ctrl+4, or Ctrl+H to open it and search): the hymns of the Himnario Adventista, from a folder of pictures and music. Search by number or title, choose "Sung", "Track only" or "No music", then add the hymn to the playlist or show it now.
- When a hymn goes live, its music starts and the slides follow the music. The arrow keys still change the slide. A double-click on a slide makes the music jump to that slide. The music stops when the hymn leaves the screens.
- The hymn files are not part of the app. Copy them into the hymnal folder (`Documents\Himnario`, or a folder chosen in the Hymnal tab). `npm run himnario` copies them from the old "Himnario Adventista" program.
- The music of a hymn is "Track only" unless you choose another kind. The app remembers the last choice on that computer.
- New "Hide screens" button in the top bar: it takes this app off the output screens, so they show the Windows desktop (Zoom, a browser, another program). The button is yellow while the screens are hidden; click it again to show the screens. Items stay live and sound keeps playing while the screens are hidden.
- The project is now at `github.com/iglesia-adventista-miramonte/iad7-media-console`, and updates come from its GitHub releases. A computer that has version 1.5.0 or older needs the 2.0.0 installer once; after that it updates itself from the new place.

## 1.5.0 – 2026-11-14

- Presenter clicker in the background: on the Setup tab, click "Pair clicker" and press the Next button on the clicker. Then its next, previous and black screen buttons work even when another program (for example Chrome) is in front. Only the clicker does this; the keyboard keeps working as normal. "Last button" shows each press, so you can test it.
- Stage screen: a new Stage / Full screen switch on the Stage card. Full screen shows what the audience sees on the whole stage screen, for example a lyric video for the singers. Stage messages still show on top.
- The Screens tab is now called "Setup".

## 1.4.0 – 2026-11-10

- New start screen when the app opens: continue the last service, start a new service from a preset, open a recent service, or start an empty one. "Start screen" in the bottom bar opens it again.
- Presets: "Save as preset" in the bottom bar saves the playlist and the program times with a name, the usual days (for example Monday and Wednesday) and the usual time. The app suggests the preset for today with the closest time. Enter continues the last service if it is from today, and otherwise starts the suggested preset.
- The Order tab is now called "Playlist".
- Presenter clickers: while slides are live, ↓ and ↑ go to the next and previous slide (before, they only moved the selection in the playlist).
- After the last slide, the next slide key now shows the idle screen. It no longer starts the next item, so a clicker cannot start a song by accident. Slides with Loop or Auto-advance work as before.

## 1.3.1 – 2026-11-04

- Bible tab: the verse list now scrolls by itself to keep the selected verse in view, for example with the arrow keys, a typed number or a search.
- Bible tab: the number grid on the left now scrolls to the selected verse or chapter.
- Fixed: the Bible tab could stop working the first time a Bible was added on a computer that had none.

## 1.3.0 – 2026-11-04

- Folders in the order now show their subfolders, up to 3 levels deep. Click a subfolder to open it. Search looks in all subfolders and shows where each file is.
- A folder that has media files in subfolders now becomes one folder item when you drop it on the order. Before, the files in its subfolders were left out.
- The file list of a big folder now shows all files, not only the first 200.
- Fixed: after a click on a checkbox, the keyboard and the clicker stopped working until you clicked somewhere else, and Space changed the checkbox instead of going to the next item.

## 1.2.0 – 2026-11-03

- The shared folder is now called "Resource folder". It can be any folder, on this computer or on the network.
- New "⋯" button on the Resource folder: "Change folder…" picks another folder, and "Clear" stops watching the folder. Items already in the order stay.
- The Resource folder title row now fits in the column, also with a long status like "Too many files".

## 1.1.0 – 2026-11-03

- Bible verses now cover the live slide or video instead of removing it. A video keeps playing under the verse. Press Esc once to remove the verse and show the slide again. You can turn this off in the Bible options.
- New Bible option "Back to Order after verse": when a verse leaves the screens, the Order tab opens with the live item selected. It is off by default.
- The left tabs are now Order, Bible and Library. Press Ctrl+1, Ctrl+2 or Ctrl+3 to open them.
- Shared folder: click its title to close or open it. Drag its top edge to change its height. Double-click the edge to go back to the normal size.
- The app has its own icon: a gold play button with a cross.

## 1.0.0 – 2026-10-29

- Service order with videos, pictures, PDF slides, PowerPoint files, songs and typed text. Preview, then "Go live".
- Output to several screens in groups (for example Main for the projector, Stage for the participant monitor). Idle screen with the church logo when nothing is live.
- Bible: search, picker, and download of free versions. Import of other versions from a file.
- Hymnal and other folders with search. Watching of the shared folder for new files.
- Background music with fade, and an audio output device.
- Stage screen: clock, countdown, messages, and the program of the service with the time left for each part.
- Library, favorites, hotkeys F1–F8, and past services.
- Keys for presenter clickers. Esc twice clears all screens.
- Remote control from a phone or another computer on the church network, with a PIN.
- Updates over the internet: a new version downloads by itself and installs when the app closes.
