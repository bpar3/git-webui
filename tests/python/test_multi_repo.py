import os


def test_open_repo_registers_and_activates(backend, handler_state, git_repo):
    resolved = backend.GitParRequestHandler.open_repo(str(git_repo))
    assert resolved == os.path.realpath(str(git_repo))
    assert backend.GitParRequestHandler.REPO_ROOT == resolved
    assert backend.GitParRequestHandler.OPEN_REPOS == [resolved]


def test_open_repo_twice_does_not_duplicate_tab(backend, handler_state, git_repo):
    backend.GitParRequestHandler.open_repo(str(git_repo))
    backend.GitParRequestHandler.open_repo(str(git_repo))
    assert backend.GitParRequestHandler.OPEN_REPOS == [os.path.realpath(str(git_repo))]


def test_open_two_repos_keeps_both_as_tabs(backend, handler_state, git_repo, second_git_repo):
    backend.GitParRequestHandler.open_repo(str(git_repo))
    backend.GitParRequestHandler.open_repo(str(second_git_repo))
    assert backend.GitParRequestHandler.OPEN_REPOS == [
        os.path.realpath(str(git_repo)),
        os.path.realpath(str(second_git_repo)),
    ]
    # opening the second repo made it active, the first tab stays open
    assert backend.GitParRequestHandler.REPO_ROOT == os.path.realpath(str(second_git_repo))


def test_close_repo_removes_tab_and_activates_remaining(backend, handler_state, git_repo, second_git_repo):
    backend.GitParRequestHandler.open_repo(str(git_repo))
    backend.GitParRequestHandler.open_repo(str(second_git_repo))

    next_active = backend.GitParRequestHandler.close_repo(str(second_git_repo))

    assert next_active == os.path.realpath(str(git_repo))
    assert backend.GitParRequestHandler.REPO_ROOT == os.path.realpath(str(git_repo))
    assert backend.GitParRequestHandler.OPEN_REPOS == [os.path.realpath(str(git_repo))]


def test_close_last_repo_leaves_none_active(backend, handler_state, git_repo):
    backend.GitParRequestHandler.open_repo(str(git_repo))
    next_active = backend.GitParRequestHandler.close_repo(str(git_repo))
    assert next_active is None
    assert backend.GitParRequestHandler.REPO_ROOT is None
    assert backend.GitParRequestHandler.OPEN_REPOS == []


def test_close_inactive_tab_keeps_current_active_repo(backend, handler_state, git_repo, second_git_repo):
    backend.GitParRequestHandler.open_repo(str(git_repo))
    backend.GitParRequestHandler.open_repo(str(second_git_repo))

    # git_repo is not the active tab (second_git_repo is); closing it
    # should not change which repo is active.
    backend.GitParRequestHandler.close_repo(str(git_repo))

    assert backend.GitParRequestHandler.REPO_ROOT == os.path.realpath(str(second_git_repo))
    assert backend.GitParRequestHandler.OPEN_REPOS == [os.path.realpath(str(second_git_repo))]


def test_get_open_repo_entries_reports_active_flag(backend, handler_state, git_repo, second_git_repo):
    backend.GitParRequestHandler.open_repo(str(git_repo))
    backend.GitParRequestHandler.open_repo(str(second_git_repo))

    entries = backend.GitParRequestHandler.get_open_repo_entries()
    assert len(entries) == 2
    by_path = {entry["path"]: entry for entry in entries}
    assert by_path[os.path.realpath(str(git_repo))]["active"] is False
    assert by_path[os.path.realpath(str(second_git_repo))]["active"] is True


def test_open_repos_persist_across_state_reload(backend, handler_state, git_repo, second_git_repo):
    backend.GitParRequestHandler.open_repo(str(git_repo))
    backend.GitParRequestHandler.open_repo(str(second_git_repo))

    # Simulate a server restart: reload state from the (tmp) state file.
    backend.GitParRequestHandler.load_state()

    assert backend.GitParRequestHandler.OPEN_REPOS == [
        os.path.realpath(str(git_repo)),
        os.path.realpath(str(second_git_repo)),
    ]




def test_load_state_falls_back_to_the_pre_rename_location(backend, handler_state, git_repo, tmp_path, monkeypatch):
    """Renaming the app moved its config directory. An existing install
    should keep its open repos rather than starting empty, so the old
    location is read once when the new file isn't there yet."""
    import json
    legacy = tmp_path / "legacy" / "state.json"
    legacy.parent.mkdir(parents=True)
    legacy.write_text(json.dumps({"open_repos": [str(git_repo)], "recent_repos": [str(git_repo)]}))
    monkeypatch.setattr(backend, "legacy_app_state_path", lambda: str(legacy))

    handler_state.APP_STATE_PATH = str(tmp_path / "new" / "state.json")
    handler_state.load_state()

    assert handler_state.OPEN_REPOS == [str(git_repo)]
    assert handler_state.RECENT_REPOS == [str(git_repo)]
    # The old file is left untouched - the next save goes to the new path.
    assert legacy.exists()


def test_load_state_prefers_the_new_location_when_present(backend, handler_state, git_repo, second_git_repo, tmp_path, monkeypatch):
    import json
    legacy = tmp_path / "legacy" / "state.json"
    legacy.parent.mkdir(parents=True)
    legacy.write_text(json.dumps({"open_repos": [str(git_repo)]}))
    monkeypatch.setattr(backend, "legacy_app_state_path", lambda: str(legacy))

    current = tmp_path / "new" / "state.json"
    current.parent.mkdir(parents=True)
    current.write_text(json.dumps({"open_repos": [str(second_git_repo)]}))
    handler_state.APP_STATE_PATH = str(current)
    handler_state.load_state()

    assert handler_state.OPEN_REPOS == [str(second_git_repo)]
