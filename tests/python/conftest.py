import importlib.util
import os
import subprocess
import sys
from importlib.machinery import SourceFileLoader
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND_SCRIPT = REPO_ROOT / "src" / "bin" / "gitpar"


def _load_backend_module():
    loader = SourceFileLoader("gitpar_backend", str(BACKEND_SCRIPT))
    spec = importlib.util.spec_from_loader(loader.name, loader)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    loader.exec_module(module)
    return module


@pytest.fixture(scope="session")
def backend():
    return _load_backend_module()


def _run_git(repo_path, *args):
    env = dict(os.environ)
    env.update({
        "GIT_AUTHOR_NAME": "Test User",
        "GIT_AUTHOR_EMAIL": "test@example.com",
        "GIT_COMMITTER_NAME": "Test User",
        "GIT_COMMITTER_EMAIL": "test@example.com",
    })
    result = subprocess.run(
        ["git", *args],
        cwd=str(repo_path),
        capture_output=True,
        text=True,
        env=env,
    )
    assert result.returncode == 0, result.stderr
    return result.stdout


def _make_git_repo(repo_path):
    repo_path.mkdir()
    _run_git(repo_path, "init", "-b", "master")
    _run_git(repo_path, "config", "user.email", "test@example.com")
    _run_git(repo_path, "config", "user.name", "Test User")
    (repo_path / "README.md").write_text("hello\n")
    _run_git(repo_path, "add", "README.md")
    _run_git(repo_path, "commit", "-m", "Initial commit")
    return repo_path


@pytest.fixture()
def git_repo(tmp_path):
    """A throwaway git repo with a single commit on `master`, for backend tests."""
    return _make_git_repo(tmp_path / "repo")


@pytest.fixture()
def second_git_repo(tmp_path):
    """A second, independent throwaway git repo, for multi-repo tests."""
    return _make_git_repo(tmp_path / "repo2")


@pytest.fixture()
def handler_state(backend, tmp_path):
    """Isolates GitParRequestHandler's class-level state (REPO_ROOT, OPEN_REPOS,
    RECENT_REPOS, ...) for a single test, redirecting its persisted state file
    to a tmp path so tests never touch the real ~/.config/gitpar/state.json."""
    handler = backend.GitParRequestHandler
    saved = {
        "WEB_ROOT": handler.WEB_ROOT,
        "REPO_ROOT": handler.REPO_ROOT,
        "APP_STATE_PATH": handler.APP_STATE_PATH,
        "RECENT_REPOS": list(handler.RECENT_REPOS),
        "WORKSPACE_ROOT": handler.WORKSPACE_ROOT,
        "RECENT_WORKSPACES": list(handler.RECENT_WORKSPACES),
        "OPEN_REPOS": list(handler.OPEN_REPOS),
    }
    handler.APP_STATE_PATH = str(tmp_path / "state.json")
    handler.REPO_ROOT = None
    handler.RECENT_REPOS = []
    handler.WORKSPACE_ROOT = None
    handler.RECENT_WORKSPACES = []
    handler.OPEN_REPOS = []
    try:
        yield handler
    finally:
        for key, value in saved.items():
            setattr(handler, key, value)
