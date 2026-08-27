# OpenCode Agent Instructions for GitPar

## Project Structure & Architecture
- This is a standalone web-based user interface for git, featuring a Python backend and a frontend built with HTML/JS/CSS.
- **Source Code:** All active development happens in the `src/` directory.
- **Build Artifacts:** The `dist/` directory holds the built version of the app for local development.
- **Release Folder:** `release/` stages a `/usr`-shaped tree for system installs. It is build output and is **not** committed - regenerate it with `grunt release` rather than editing it.

## Development & Build Workflow
- **Prerequisites:** Requires Node.js, `grunt-cli` (globally), and `bower`.
- **Dependencies:** Run `npm install` and `bower install` to set up dependencies.
- **Build:** Run `grunt` to build the source from `src/` into the `dist/` folder.
- **Development Server:** Run `grunt serve` to build the app and start the GitPar server from the `dist/` directory.
- **Watch Mode:** Run `grunt watch` to automatically rebuild files as you change them in `src/`.
- **Release:** Run `grunt release` to stage the built app from `dist/` into `release/` for a system install. Neither directory is committed.
- **Clean:** `npm run clean` removes build output; `npm run clean:all` also drops `node_modules/` and `bower_components/`.
- **Standalone/headless packaging:** `packaging/build.sh` installs dependencies (npm/bower, PyInstaller, and - on Linux - the system libraries Tauri needs) and builds a headless single-binary server plus, if Rust is available, a standalone desktop app. See `packaging/README.md`.

## Testing
- **Frontend (Jest):** Run `npm test` to run `tests/js/**/*.test.js`. These unit-test the pure/parsing helper functions in `src/share/gitpar/web/js/gitpar.js` by loading it in an isolated `vm` context (see `tests/js/helpers/load-gitpar.js`) rather than a full browser DOM.
- **Backend (pytest):** Run `pytest` (or `npm run test:py`) to run `tests/python/*.py`. These import `src/bin/gitpar` directly and exercise it against real throwaway git repos created per-test (see `tests/python/conftest.py`).
- Both suites must pass before committing backend/frontend changes. Add new tests alongside new logic rather than relying solely on manual verification.
- Still verify UI/UX changes manually using `grunt serve` — the test suites cover logic and backend behavior, not visual/interaction correctness.
