# GitPar

A standalone desktop-style user interface for git repositories, served
by a small local web server and viewed in your browser.

Commits, branches, tags and stashes are shown together on one graph.
Selecting a commit opens it in place with its message and file list, and
expanding it gives a filterable file list beside the diff. Local changes
can be reviewed, staged line by line, and committed. Several repositories
can be open at once as tabs.

It has very few dependencies: git, python, and a web browser.

## Installation

### From a clone

```
git clone <gitpar-repo-url>
cd gitpar
npm install && npx bower install
npx grunt
```

`grunt` builds into `dist/`. Run it with:

```
./dist/bin/gitpar
```

To install it on the system, `grunt release` produces a `release/` tree
whose layout mirrors `/usr`:

```
cp -rf release/* /usr
```

### Standalone builds

`packaging/build.sh` produces a single-file headless server and, if Rust
is available, a standalone desktop app. See `packaging/README.md`.

## Usage

`cd` to any git repository and run:

```
gitpar
```

This starts a local HTTP server and opens your browser at the UI. It
binds to the loopback interface only — the repository is never exposed
on the network.

Useful flags:

- `--no-browser` — don't try to open a browser. Required on a headless
  machine, which would otherwise stall looking for one.
- `--port <n>` — listen on a specific port.
- `--repo-root <path>` — open a repository other than the current
  directory.

## Views

**Commits** shows the graph, with branch, tag and stash labels beside
the commits they point at. Selecting a commit expands it in place;
expanding further opens the full commit with its files and diff.

**Changes** lists your working copy and staging area. Diffs can be
staged, unstaged or discarded a line or a hunk at a time.

**Search** filters the current list as you type.

Clicking the branch name in the toolbar lists every local and remote
branch, with ahead/behind counts.

## Dependencies

### Runtime

- git
- python 3
- a modern browser

### Development

- the runtime dependencies, plus
- node.js
- grunt-cli

Run `npm test` for the frontend tests and `pytest` for the backend ones.
Both must pass before committing. See `AGENTS.md`.

## Uninstallation

```
rm -rf <gitpar-clone-path>
rm -f "$HOME/.local/bin/gitpar"
git config --global --remove-section gitpar
```

Settings live in `~/.config/gitpar`.

## Built on

GitPar started from [git-webui](https://github.com/alberthier/git-webui)
by [Éric ALBER](mailto:eric.alber@gmail.com)
([@eric_alber](https://twitter.com/eric_alber)).

## License

This software is licensed under the [Apache 2.0](http://www.apache.org/licenses/LICENSE-2.0.html) license
