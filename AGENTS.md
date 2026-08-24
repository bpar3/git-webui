# OpenCode Agent Instructions for git-webui

## Project Structure & Architecture
- This is a standalone web-based user interface for git, featuring a Python backend and a frontend built with HTML/JS/CSS.
- **Source Code:** All active development happens in the `src/` directory.
- **Build Artifacts:** The `dist/` directory holds the built version of the app for local development.
- **Release Folder:** The `release/` folder is explicitly for end-user releases. **Do not commit work-in-progress code or directly edit files in the `release/` directory.**

## Development & Build Workflow
- **Prerequisites:** Requires Node.js, `grunt-cli` (globally), and `bower`.
- **Dependencies:** Run `npm install` and `bower install` to set up dependencies.
- **Build:** Run `grunt` to build the source from `src/` into the `dist/` folder.
- **Development Server:** Run `grunt serve` to build the app and start the git-webui server from the `dist/` directory.
- **Watch Mode:** Run `grunt watch` to automatically rebuild files as you change them in `src/`.
- **Release:** When a release is ready, run `grunt release` to copy the built app from `dist/` to `release/`.

## Testing
- Currently, there are no automated tests defined (`npm test` simply echoes an error). Focus on manual verification using `grunt serve` to ensure changes work locally.
