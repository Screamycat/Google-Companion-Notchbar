# Project Rules: Google-Companion Notchbar

## 1. Documentation & README Synchronization (Mandatory)
- Every time a new feature, tab, setting, or companion reaction is added or modified:
  - Immediately update [`README.md`](./README.md) to accurately reflect the changes.
  - Update the **Features & Tour** section with clear descriptions and usage guidance.
  - Update the **Settings & Customization** table if any settings or configuration options were added.
  - Update the **Roadmap & Upcoming Milestones** section by marking completed milestones as shipped (e.g. `[x] Shipped in vX.Y.Z!`).
  - Keep all screenshots, links, and markdown formatting cohesive and current.

## 2. Release & Version Protocol
Whenever cutting a release (e.g. `vX.Y.Z`):
1. **Manifest Synchronization**: Synchronously update version numbers in:
   - `package.json`
   - `src-tauri/Cargo.toml`
   - `src-tauri/tauri.conf.json`
2. **Release Notes**:
   - Create `docs/releases/vX.Y.Z.md` with complete, bulleted technical and user-facing release notes.
3. **In-App Changelog**:
   - Prepend the new release entry to `src/changelog.json` with both German (`de`) and English (`en`) localized summaries.
4. **README Consistency**:
   - Ensure `README.md` reflects all shipped features and marks the milestone as shipped.
5. **Quality Verification**:
   - Run `npm run typecheck` and `npm run build`.
   - Run `cargo check --manifest-path src-tauri/Cargo.toml`.
6. **Git Tagging & Push**:
   - Commit with message: `feat(release): vX.Y.Z - <summary>`.
   - Tag with annotated tag: `git tag -a vX.Y.Z -m "Release vX.Y.Z"`.
   - Push commit and tags to `origin` (`my-custom-notch` and `main`).

## 3. Preserving Documentation Integrity
- Always preserve existing comments, docstrings, and tests unless specifically instructed to refactor them.
- Format all internal codebase references as clickable GitHub-style links (`[file.tsx](file:///...)`).
