---
name: release-docs-sync
description: >-
  Standardized release and documentation synchronization workflow.
  Ensures README.md, changelog.json, release notes, and version manifests
  remain completely cohesive and truthful to the codebase on every release or commit.
---

# Release & Docs Synchronization

Use this workflow whenever cutting a new release, committing a major feature milestone, or auditing project documentation to guarantee that the repository's user-facing documentation accurately reflects the codebase.

## Workflow Checklist

### 1. Codebase Audit
- Review all files changed since the previous release (`git status`, `git diff HEAD~1`).
- Identify:
  - Any newly added tabs or views (e.g. Calendar, Notes, AI Assistant).
  - Any new settings options or configuration knobs.
  - Any new companion animations, interactions, or audio gestures.
  - Any roadmap milestones completed.

### 2. README.md Synchronization
- **Overview & Features & Tour**: Add dedicated sub-sections for newly added capabilities with clear descriptions and screenshot/GIF references.
- **Settings & Customization Table**: Add rows for newly introduced settings categories and explain configurable parameters.
- **Controls & Gestures Table**: Update any new shortcuts, click triggers, or companion petting/poking gestures.
- **Roadmap & Milestones**: Update completed items from `* 📅 [Name]` to `* 📅 [**Name**] — **Shipped in vX.Y.Z!**`.

### 3. Version Manifest Synchronization
- Synchronously bump versions across all project descriptors:
  - `package.json` (`version`)
  - `src-tauri/Cargo.toml` (`[package] version`)
  - `src-tauri/tauri.conf.json` (`version`)

### 4. Release Notes & Changelog
- **Release Documentation**: Create `docs/releases/vX.Y.Z.md` with complete technical highlights.
- **In-App Changelog**: Prepend new release entry to `src/changelog.json` with bilingual German (`de`) and English (`en`) bullet points for the in-app modal.

### 5. Verification
- Run `npm run typecheck`
- Run `npm run build`
- Run `cargo check --manifest-path src-tauri/Cargo.toml`

### 6. Git Commit, Tagging & Push
- Stage all modified and untracked files (`git add -A`).
- Create conventional commit: `feat(release): vX.Y.Z - <summary>`.
- Tag annotated release: `git tag -a vX.Y.Z -m "Release vX.Y.Z"`.
- Push commit and tags to remote:
  ```powershell
  git push origin my-custom-notch --tags
  git push origin my-custom-notch:main
  ```
