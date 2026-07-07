# Skill: Release CI

Use this for GitHub Actions, desktop packaging, installers, or release changes.

## What Pushes Trigger

- Push to `main` runs `.github/workflows/release.yml`.
- Packaging uses the Electron-first app package in `desktop/`.
- The workflow builds:
  - macOS Apple Silicon DMG on `macos-14`.
  - macOS Intel DMG on `macos-15-intel`.
  - Windows x64 NSIS installer on `windows-latest`.
- A successful `main` push creates a prerelease named `desktop-<short-sha>` and
  uploads all installers as release assets.
- Artifacts are also uploaded to the workflow run for 7 days.
- Manual `workflow_dispatch` can create a custom prerelease tag.
- Pushing a `v*` tag creates a normal GitHub Release.

## Cost / Signing Policy

- The repo is public, so standard hosted runner minutes are the lowest-cost path.
- Installers are unsigned unless paid signing/notarization is explicitly
  requested.
- Do not add larger runners, self-hosting, or paid signing flows without user
  approval.

## Verification

- Validate YAML syntax after workflow edits.
- For release workflow changes, push only after local validation and explicit
  user permission.
- Watch the remote run to completion when the user asks for end-to-end release
  confidence.

## Known CI Gotcha

macOS DMG creation can intermittently fail on hosted runners with
`hdiutil ... Resource busy`. The workflow retries package creation and clears
transient DMG state before retrying.
