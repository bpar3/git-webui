import os


def test_open_repo_registers_and_activates(backend, handler_state, git_repo):
    resolved = backend.WebUiRequestHandler.open_repo(str(git_repo))
    assert resolved == os.path.realpath(str(git_repo))
    assert backend.WebUiRequestHandler.REPO_ROOT == resolved
    assert backend.WebUiRequestHandler.OPEN_REPOS == [resolved]


def test_open_repo_twice_does_not_duplicate_tab(backend, handler_state, git_repo):
    backend.WebUiRequestHandler.open_repo(str(git_repo))
    backend.WebUiRequestHandler.open_repo(str(git_repo))
    assert backend.WebUiRequestHandler.OPEN_REPOS == [os.path.realpath(str(git_repo))]


def test_open_two_repos_keeps_both_as_tabs(backend, handler_state, git_repo, second_git_repo):
    backend.WebUiRequestHandler.open_repo(str(git_repo))
    backend.WebUiRequestHandler.open_repo(str(second_git_repo))
    assert backend.WebUiRequestHandler.OPEN_REPOS == [
        os.path.realpath(str(git_repo)),
        os.path.realpath(str(second_git_repo)),
    ]
    # opening the second repo made it active, the first tab stays open
    assert backend.WebUiRequestHandler.REPO_ROOT == os.path.realpath(str(second_git_repo))


def test_close_repo_removes_tab_and_activates_remaining(backend, handler_state, git_repo, second_git_repo):
    backend.WebUiRequestHandler.open_repo(str(git_repo))
    backend.WebUiRequestHandler.open_repo(str(second_git_repo))

    next_active = backend.WebUiRequestHandler.close_repo(str(second_git_repo))

    assert next_active == os.path.realpath(str(git_repo))
    assert backend.WebUiRequestHandler.REPO_ROOT == os.path.realpath(str(git_repo))
    assert backend.WebUiRequestHandler.OPEN_REPOS == [os.path.realpath(str(git_repo))]


def test_close_last_repo_leaves_none_active(backend, handler_state, git_repo):
    backend.WebUiRequestHandler.open_repo(str(git_repo))
    next_active = backend.WebUiRequestHandler.close_repo(str(git_repo))
    assert next_active is None
    assert backend.WebUiRequestHandler.REPO_ROOT is None
    assert backend.WebUiRequestHandler.OPEN_REPOS == []


def test_close_inactive_tab_keeps_current_active_repo(backend, handler_state, git_repo, second_git_repo):
    backend.WebUiRequestHandler.open_repo(str(git_repo))
    backend.WebUiRequestHandler.open_repo(str(second_git_repo))

    # git_repo is not the active tab (second_git_repo is); closing it
    # should not change which repo is active.
    backend.WebUiRequestHandler.close_repo(str(git_repo))

    assert backend.WebUiRequestHandler.REPO_ROOT == os.path.realpath(str(second_git_repo))
    assert backend.WebUiRequestHandler.OPEN_REPOS == [os.path.realpath(str(second_git_repo))]


def test_get_open_repo_entries_reports_active_flag(backend, handler_state, git_repo, second_git_repo):
    backend.WebUiRequestHandler.open_repo(str(git_repo))
    backend.WebUiRequestHandler.open_repo(str(second_git_repo))

    entries = backend.WebUiRequestHandler.get_open_repo_entries()
    assert len(entries) == 2
    by_path = {entry["path"]: entry for entry in entries}
    assert by_path[os.path.realpath(str(git_repo))]["active"] is False
    assert by_path[os.path.realpath(str(second_git_repo))]["active"] is True


def test_open_repos_persist_across_state_reload(backend, handler_state, git_repo, second_git_repo):
    backend.WebUiRequestHandler.open_repo(str(git_repo))
    backend.WebUiRequestHandler.open_repo(str(second_git_repo))

    # Simulate a server restart: reload state from the (tmp) state file.
    backend.WebUiRequestHandler.load_state()

    assert backend.WebUiRequestHandler.OPEN_REPOS == [
        os.path.realpath(str(git_repo)),
        os.path.realpath(str(second_git_repo)),
    ]


