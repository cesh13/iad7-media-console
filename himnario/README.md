# Hymnal folder

The app reads the hymn pictures and the hymn music from this folder. The files
are not part of the project (they are about 3.8 GB) and are never uploaded.
Copy them here by hand, or with the import script.

```
himnario/
  Letra/
    001 - Cantad alegres al Senor/      one folder per hymn
      01.jpg  02.jpg  03.jpg …          one picture per slide, in file-name order
  Musica/
    Cantado/
      001 - Cantad alegres al Senor.mp3 sung
    Instrumental/
      001 - Cantad alegres al Senor.mp3 track only
  himnos.json                           optional: titles and slide times
```

Rules:

- A hymn is found by the **number at the start of the name**. The rest of the
  name can be different in each folder.
- A hymn needs at least one picture. The music is optional: a hymn with no
  music file shows its slides without sound.
- More than one music file with the same number (for example "614 - Amenes B")
  gives a choice of file in the app.
- `himnos.json` gives the title with accents and the time (in seconds) when
  slide 2, 3, … starts in the music, so the slides can follow the music:

  ```json
  { "hymns": [{ "number": 1, "title": "Cantad alegres al Señor", "times": [24, 62, 98] }] }
  ```

  Without this file the titles come from the folder names, and the operator
  changes the slides with the arrow keys.

## Fill the folder from the old "Himnario Adventista" program

```bash
npm run himnario -- "C:\path\to\Himnario NUEVA VERSION PC"
```

This copies `Letra` and `Musica` and writes `himnos.json`. To fill another
folder, give it as a second path.

## Where the app looks

- Dev copy (`npm run dev`): this folder.
- Installed app: `Documents\Himnario`.
- Or any folder: Hymnal tab › **Change folder…**. After you copy files into
  the folder, click **Read again**.
