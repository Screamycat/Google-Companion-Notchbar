# Project Rules: Google-Companion Notchbar

## 1. GitHub & Documentation Synchronization (Mandatory)
Every time a feature, tab, setting, bugfix, or companion reaction is committed or released:
1. **README Synchronization**:
   - Immediately update [`README.md`](./README.md) to accurately reflect the changes.
   - Update **Features & Tour** with clear usage descriptions and UI asset references.
   - Update **Settings & Customization** if any configuration option or knob was added/modified.
   - Update **Roadmap & Upcoming Milestones** by marking completed milestones as shipped (e.g. `[x] Shipped in vX.Y.Z!`).
   - Keep all screenshots, links, and markdown formatting cohesive and current.
2. **GitHub Milestones, Issues & Projects**:
   - Keep GitHub milestones, issues, and project boards in lockstep with the codebase.
   - Close completed milestones and issues corresponding to shipped work (e.g. Milestone 1: Google Calendar Tab, Issue #1).
   - Update issue descriptions, comments, or project board columns ("In Progress" ➔ "Done").
   - Link commits and PRs directly to issue numbers (e.g., `Closes #1`).
3. **In-App Changelog & Release Notes**:
   - Prepend new entries to `src/changelog.json` in both German (`de`) and English (`en`).
   - Create `docs/releases/vX.Y.Z.md` with complete technical highlights for every version bump.
4. **Manifest Synchronization**:
   - Keep version numbers identical across `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json`.

## 2. Release & Version Protocol
Whenever cutting a release (e.g. `vX.Y.Z`):
1. **Manifest Synchronization**: Synchronously update version numbers across `package.json`, `Cargo.toml`, and `tauri.conf.json`.
2. **Release Notes**: Create `docs/releases/vX.Y.Z.md` with complete, bulleted technical and user-facing release notes.
3. **In-App Changelog**: Prepend the new release entry to `src/changelog.json` with localized summaries (`de` and `en`).
4. **README Consistency**: Ensure `README.md` reflects all shipped features and marks the milestone as shipped.
5. **Quality Verification**:
   - Run `npm run typecheck` and `npm run build`.
   - Run `cargo check --manifest-path src-tauri/Cargo.toml`.
6. **Git Tagging & Multi-Branch Push**:
   - Commit with message: `feat(release): vX.Y.Z - <summary>`.
   - Tag with annotated tag: `git tag -a vX.Y.Z -m "Release vX.Y.Z"`.
   - Push commit and tags to `origin` (`my-custom-notch` and `main`).

## 3. Preserving Documentation Integrity
- Always preserve existing comments, docstrings, and tests unless specifically instructed to refactor them.
- Format all internal codebase references as clickable GitHub-style links (`[file.tsx](file:///...)`).
