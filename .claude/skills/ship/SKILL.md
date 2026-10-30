---
name: ship
description: Make and publish a new release of Media Console. Raises the version, checks the code, writes the release notes, commits and tags the release, builds the Windows installer, and uploads it to GitHub Releases so the church computer updates itself. Use when the user says "ship", "release", "publish", "package", "package a new version", "make an installer", "new version", "send an update", "build for the church PC", or similar.
---

# Ship a new version

The installed app on the church computer updates itself from GitHub Releases
(`docs/SPEC.md` section 12). Shipping means: a new version number, a commit
and tag, and a GitHub release with the installer, `latest.yml` and the
`.blockmap`.

Follow these steps in order. Stop and tell the user if a step fails. Do not
skip a step to make the release go through.

If the user asks only for an installer to test ("make an installer", "build it
but don't publish"), run only steps 1–3 and then `npm run dist`. That builds
into `dist/` without a new version and without uploading.

## 1. Check that publishing can work

- `GH_TOKEN` must be set. Check it without showing it:
  `[ -n "$GH_TOKEN" ] && echo set || echo missing` (Bash) or
  `[bool]$env:GH_TOKEN` (PowerShell). If it is missing, stop and tell the user
  how to make one (below). Never ask the user to paste the token in the chat,
  and never write it in a file in the project.
- The repository must be public, or the church computer cannot download the
  update. If you cannot tell, ask once.

**How the user makes a token (once):** GitHub → Settings → Developer settings
→ Personal access tokens → Fine-grained tokens → Generate new token. Repository
access: only `cesh13/iad7-media-console`. Permissions: Contents → Read and
write. Then, in a terminal on this computer: `setx GH_TOKEN "<the token>"`,
and restart Claude Code so it sees the new variable.

## 2. Check the working tree

Run `git status --short`.

- If there are uncommitted changes, show a short list and ask the user if they
  belong in this release. If yes, commit them first with a normal commit
  message that says what changed (not "release"). If no, stop: a release must
  be built from committed code only.
- Releases are made from `main`. If the branch is another one, say so and ask
  before you continue.
- Run `git fetch` and check that `main` is not behind `origin/main`.

## 3. Check the code

Run `npm run typecheck`. If it fails, show the errors and stop.

## 4. Decide the new version

Read `version` from `package.json`. Find the last release tag with
`git describe --tags --abbrev=0 --match "v*"` (there may be none yet; then use
all commits). List the commits since that tag with
`git log <tag>..HEAD --oneline`.

Pick the version bump from the user's words, or from the commits:

| Bump | When | Example |
|---|---|---|
| patch | Only fixes and small changes | 1.2.0 → 1.2.1 |
| minor | New features | 1.2.1 → 1.3.0 |
| major | Big changes, or data files from the old version no longer work | 1.3.0 → 2.0.0 |

If the user named a version or a bump type, use it. Otherwise choose one,
and tell the user which one and why in one line. If there are no commits
since the last tag, tell the user there is nothing new to ship and stop.

The first release is special: if there is no tag yet and the version is
`1.0.0`, ship `1.0.0` as it is (no bump).

## 5. Raise the version

Run `npm version <patch|minor|major|x.y.z> --no-git-tag-version`. This
changes `package.json` and `package-lock.json`.

## 6. Write the release notes

Add a new section at the top of `CHANGELOG.md` (make the file if it does not
exist, with a `# Changes` heading). Format:

```markdown
## 1.3.0 – 2026-10-29

- Short line per change, written for the media team, not for programmers.
```

Use plain, literal English (see `CLAUDE.md`). Group many small fixes into one
line. Leave out changes that only touch code structure or docs.

Also write only this version's lines (without the heading) to
`build/release-notes.md`. `electron-builder` puts this text on the GitHub
release. This file is not committed (it is in `.gitignore`).

## 7. Commit, tag and push

```bash
git add package.json package-lock.json CHANGELOG.md
git commit -m "Release v<version>"
git tag v<version>
git push origin main
git push origin v<version>
```

End the commit message with the attribution lines the session asks for. The
tag must be on GitHub before the upload, so the release points at this commit.

## 8. Build and publish

Check first that no copy of the app is running from `dist/` (a running copy
locks the files). Then run `npm run release` in the background (it takes a
few minutes). It builds the installer and uploads it to the GitHub release
`v<version>`.

When it finishes, check:

- `dist/Media Console Setup <version>.exe` and `dist/latest.yml` exist, and
  `latest.yml` has the new version.
- The output says it uploaded `Media Console Setup <version>.exe`,
  `.blockmap` and `latest.yml`. If you can, also open
  `https://github.com/cesh13/iad7-media-console/releases/tag/v<version>`.

If the upload fails (for example the token is wrong), show the error. The
commit and tag are already pushed, and that is fine: fix the cause and run
`npm run release` again. It uploads to the same release.

## 9. Tell the user

Give:

- The new version and the release notes.
- The link to the GitHub release.
- What happens at church: the next time the app starts with internet, it
  downloads the update and shows "Version x.y.z is ready" in the top bar. It
  installs when the app closes. Nothing restarts during a service.
- The first install on a new computer is still by hand: download
  `Media Console Setup <version>.exe` from the release, run it, and click
  **More info** → **Run anyway** at the Windows warning.
