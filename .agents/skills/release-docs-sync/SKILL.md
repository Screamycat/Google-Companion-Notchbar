---
name: release-docs-sync
description: >-
  Standardized release and GitHub synchronization workflow.
  Ensures README.md, GitHub Milestones, Issues, Projects, changelog.json,
  release notes, and version manifests remain completely cohesive and truthful
  to the codebase on every release or commit.
---

# Release & GitHub Documentation Synchronization

Use this workflow whenever cutting a new release, committing a major feature milestone, or auditing project documentation to guarantee that GitHub (README, Milestones, Issues, Projects, Releases) never drifts from the codebase.

## Workflow Checklist

### 1. Codebase & Scope Audit
- Review all changes since the last release/commit (`git status`, `git diff HEAD~1`).
- Identify:
  - New tabs, tools, or major features (e.g. Calendar, Notes, AI Assistant).
  - New settings toggles, custom color pickers, or tuning sliders.
  - New companion emotions, tactile gestures, or ambient animations.
  - Completed milestones or closed issue requirements.

### 2. GitHub Milestones, Issues & Projects Sync
- **Milestones**:
  - Review open GitHub Milestones for `Screamycat/Google-Companion-Notchbar`.
  - Mark completed milestones as closed/shipped (e.g., Milestone 1: Google Calendar Tab).
  - Add new roadmap milestones requested by the user.
- **Issues**:
  - Close any resolved issues (e.g., Issue #1) with a concluding comment referencing the shipping release tag (e.g., `Resolved in v0.2.0`).
- **Projects**:
  - Move completed items from "In Progress" to "Done".

### 3. README.md Synchronization
- **Overview Bullets**: Ensure all active core capabilities are represented.
- **Features & Tour**:
  - Include dedicated sections for all shipped tabs/features.
  - Keep sequential numbering correct.
  - Reference authentic UI screenshot / GIF assets in `docs/assets/`.
- **Settings & Customization Table**: Add/update rows for new settings tabs and configurable knobs.
- **Controls & Gestures Table**: Update new hotkeys, mouse gestures, or tactile companion interactions.
- **Roadmap & Upcoming Milestones**:
  - Mark completed milestones as shipped (e.g. `* 📅 [**Google Calendar Tab**](...) — **Shipped in v0.2.0!**`).

### 4. Version Manifest Synchronization
- Synchronously bump versions across all descriptors:
  - `package.json` (`version`)
  - `src-tauri/Cargo.toml` (`[package] version`)
  - `src-tauri/tauri.conf.json` (`version`)

### 5. In-App Changelog & Release Notes
- **Release Document**: Create `docs/releases/vX.Y.Z.md` with structured technical notes.
- **In-App Changelog**: Prepend new release entry to `src/changelog.json` with bilingual German (`de`) and English (`en`) summaries.

### 6. Verification Gate
- Run `npm run typecheck`
- Run `npm run build`
- Run `cargo check --manifest-path src-tauri/Cargo.toml`

### 7. Git Commit, Tagging & Multi-Branch Push
- Stage all files: `git add -A`.
- Conventional commit: `feat(release): vX.Y.Z - <summary>` or `docs: <summary>`.
- Annotated tag: `git tag -a vX.Y.Z -m "Release vX.Y.Z"`.
- Push to origin:
  ```powershell
  git push origin my-custom-notch --tags
  git push origin my-custom-notch:main
  ```
