import importlib.util
import os
import subprocess
import sys
from importlib.machinery import SourceFileLoader
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND_SCRIPT = REPO_ROOT / "src" / "libexec" / "git-core" / "git-webui"


def _load_backend_module():
    loader = SourceFileLoader("git_webui_backend", str(BACKEND_SCRIPT))
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


@pytest.fixture()
def git_repo(tmp_path):
    """A throwaway git repo with a single commit on `master`, for backend tests."""
    repo_path = tmp_path / "repo"
    repo_path.mkdir()
    _run_git(repo_path, "init", "-b", "master")
    _run_git(repo_path, "config", "user.email", "test@example.com")
    _run_git(repo_path, "config", "user.name", "Test User")
    (repo_path / "README.md").write_text("hello\n")
    _run_git(repo_path, "add", "README.md")
    _run_git(repo_path, "commit", "-m", "Initial commit")
    return repo_path
