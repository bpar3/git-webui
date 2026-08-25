import os


# -- worktrees ----------------------------------------------------------

def test_list_worktrees_single_main_worktree(backend, git_repo):
    response = backend.list_worktrees(str(git_repo))
    assert response["status"] == 200
    worktrees = response["payload"]["worktrees"]
    assert len(worktrees) == 1
    assert worktrees[0]["path"] == str(git_repo)
    assert worktrees[0]["branch"] == "master"
    assert worktrees[0]["detached"] is False


def test_add_worktree_with_new_branch(backend, git_repo, tmp_path):
    target = tmp_path / "wt-feature"
    response = backend.add_worktree(str(git_repo), str(target), "feature", True, "master")
    assert response["status"] == 200
    paths = [w["path"] for w in response["payload"]["worktrees"]]
    assert any(os.path.realpath(str(target)) == os.path.realpath(p) for p in paths)
    branches = [w["branch"] for w in response["payload"]["worktrees"]]
    assert "feature" in branches


def test_add_worktree_requires_path(backend, git_repo):
    response = backend.add_worktree(str(git_repo), "", "feature", True, "master")
    assert response["status"] == 400


def test_add_worktree_requires_branch_name_when_creating(backend, git_repo, tmp_path):
    response = backend.add_worktree(str(git_repo), str(tmp_path / "wt"), "", True, "master")
    assert response["status"] == 400


def test_remove_worktree(backend, git_repo, tmp_path):
    target = tmp_path / "wt-remove-me"
    backend.add_worktree(str(git_repo), str(target), "to-remove", True, "master")
    response = backend.remove_worktree(str(git_repo), str(target), True)
    assert response["status"] == 200
    paths = [w["path"] for w in response["payload"]["worktrees"]]
    assert not any(os.path.realpath(str(target)) == os.path.realpath(p) for p in paths)


def test_remove_worktree_requires_path(backend, git_repo):
    response = backend.remove_worktree(str(git_repo), "", False)
    assert response["status"] == 400


# -- stashes --------------------------------------------------------------

def test_list_stashes_empty(backend, git_repo):
    response = backend.list_stashes(str(git_repo))
    assert response["status"] == 200
    assert response["payload"]["stashes"] == []


def test_list_stashes_after_push(backend, git_repo):
    (git_repo / "README.md").write_text("hello\nchanged\n")
    backend.run_git_capture(str(git_repo), ["stash", "push", "-m", "wip work"])
    response = backend.list_stashes(str(git_repo))
    assert response["status"] == 200
    assert len(response["payload"]["stashes"]) == 1
    assert "wip work" in response["payload"]["stashes"][0]["message"]


def test_apply_stash_pop(backend, git_repo):
    (git_repo / "README.md").write_text("hello\nchanged\n")
    backend.run_git_capture(str(git_repo), ["stash", "push", "-m", "wip"])
    response = backend.apply_stash(str(git_repo), "stash@{0}", True)
    assert response["status"] == 200
    assert (git_repo / "README.md").read_text() == "hello\nchanged\n"
    assert backend.list_stashes(str(git_repo))["payload"]["stashes"] == []


def test_apply_stash_requires_ref(backend, git_repo):
    assert backend.apply_stash(str(git_repo), "", False)["status"] == 400


def test_drop_stash(backend, git_repo):
    (git_repo / "README.md").write_text("hello\nchanged\n")
    backend.run_git_capture(str(git_repo), ["stash", "push", "-m", "wip"])
    response = backend.drop_stash(str(git_repo), "stash@{0}")
    assert response["status"] == 200
    assert response["payload"]["stashes"] == []


# -- reflog -----------------------------------------------------------------

def test_list_reflog_has_initial_commit_entry(backend, git_repo):
    response = backend.list_reflog(str(git_repo))
    assert response["status"] == 200
    assert len(response["payload"]["entries"]) >= 1
    assert response["payload"]["entries"][0]["commit"]


# -- submodules ---------------------------------------------------------------

def test_list_submodules_empty_repo(backend, git_repo):
    response = backend.list_submodules(str(git_repo))
    assert response["status"] == 200
    assert response["payload"]["submodules"] == []


def test_update_submodules_noop_on_empty_repo(backend, git_repo):
    response = backend.update_submodules(str(git_repo), True)
    assert response["status"] == 200
    assert response["payload"]["submodules"] == []


# -- .gitignore ---------------------------------------------------------------

def test_add_to_gitignore_creates_file(backend, git_repo):
    response = backend.add_to_gitignore(str(git_repo), "*.log")
    assert response["status"] == 200
    assert response["payload"]["added"] is True
    assert (git_repo / ".gitignore").read_text().strip() == "*.log"


def test_add_to_gitignore_appends_and_dedupes(backend, git_repo):
    backend.add_to_gitignore(str(git_repo), "*.log")
    response = backend.add_to_gitignore(str(git_repo), "*.log")
    assert response["status"] == 200
    assert response["payload"]["added"] is False
    lines = (git_repo / ".gitignore").read_text().splitlines()
    assert lines.count("*.log") == 1


def test_add_to_gitignore_requires_pattern(backend, git_repo):
    assert backend.add_to_gitignore(str(git_repo), "")["status"] == 400


# -- blame ----------------------------------------------------------------

def test_get_blame_reports_lines_and_author(backend, git_repo):
    response = backend.get_blame(str(git_repo), "README.md")
    assert response["status"] == 200
    lines = response["payload"]["lines"]
    assert len(lines) == 1
    assert lines[0]["text"] == "hello"
    assert lines[0]["author"] == "Test User"
    assert len(lines[0]["commit"]) == 40


def test_get_blame_requires_path(backend, git_repo):
    assert backend.get_blame(str(git_repo), "")["status"] == 400


# -- conflicts --------------------------------------------------------------

def test_get_conflict_status_clean_repo(backend, git_repo):
    response = backend.get_conflict_status(str(git_repo))
    assert response["status"] == 200
    assert response["payload"]["merging"] is False
    assert response["payload"]["rebasing"] is False
    assert response["payload"]["conflicted_files"] == []


def test_get_conflict_status_detects_merge_conflict(backend, git_repo):
    backend.create_branch(str(git_repo), "feature", "master", True)
    (git_repo / "README.md").write_text("feature change\n")
    backend.run_git_capture(str(git_repo), ["commit", "-am", "feature change"])
    backend.run_git_capture(str(git_repo), ["checkout", "master"])
    (git_repo / "README.md").write_text("master change\n")
    backend.run_git_capture(str(git_repo), ["commit", "-am", "master change"])
    backend.run_git_capture(str(git_repo), ["merge", "feature"])

    response = backend.get_conflict_status(str(git_repo))
    assert response["status"] == 200
    assert response["payload"]["merging"] is True
    assert "README.md" in response["payload"]["conflicted_files"]


def test_resolve_conflict_ours(backend, git_repo):
    backend.create_branch(str(git_repo), "feature", "master", True)
    (git_repo / "README.md").write_text("feature change\n")
    backend.run_git_capture(str(git_repo), ["commit", "-am", "feature change"])
    backend.run_git_capture(str(git_repo), ["checkout", "master"])
    (git_repo / "README.md").write_text("master change\n")
    backend.run_git_capture(str(git_repo), ["commit", "-am", "master change"])
    backend.run_git_capture(str(git_repo), ["merge", "feature"])

    response = backend.resolve_conflict(str(git_repo), "README.md", "ours")
    assert response["status"] == 200
    assert response["payload"]["conflicted_files"] == []
    assert (git_repo / "README.md").read_text() == "master change\n"


def test_resolve_conflict_requires_valid_resolution(backend, git_repo):
    response = backend.resolve_conflict(str(git_repo), "README.md", "sideways")
    assert response["status"] == 400


# -- interactive rebase -------------------------------------------------------

def _commit_file(backend, repo, name, content, message):
    (repo / name).write_text(content)
    backend.run_git_capture(str(repo), ["add", name])
    backend.run_git_capture(str(repo), ["commit", "-m", message])


def test_run_interactive_rebase_plan_drops_a_commit(backend, git_repo):
    base_sha = backend.run_git_capture(str(git_repo), ["rev-parse", "HEAD"])["stdout"].strip()
    _commit_file(backend, git_repo, "a.txt", "a\n", "add a")
    drop_sha = backend.run_git_capture(str(git_repo), ["rev-parse", "HEAD"])["stdout"].strip()
    _commit_file(backend, git_repo, "b.txt", "b\n", "add b")
    keep_sha = backend.run_git_capture(str(git_repo), ["rev-parse", "HEAD"])["stdout"].strip()

    response = backend.run_interactive_rebase_plan(
        str(git_repo),
        base_sha,
        [
            {"commit": drop_sha, "action": "drop"},
            {"commit": keep_sha, "action": "pick"},
        ],
    )
    assert response["status"] == 200
    assert not (git_repo / "a.txt").exists()
    assert (git_repo / "b.txt").exists()


def test_run_interactive_rebase_plan_requires_base(backend, git_repo):
    response = backend.run_interactive_rebase_plan(str(git_repo), "", [{"commit": "abc", "action": "pick"}])
    assert response["status"] == 400


def test_run_interactive_rebase_plan_requires_actions(backend, git_repo):
    response = backend.run_interactive_rebase_plan(str(git_repo), "HEAD", [])
    assert response["status"] == 400


def test_run_interactive_rebase_plan_rejects_unknown_action(backend, git_repo):
    response = backend.run_interactive_rebase_plan(str(git_repo), "HEAD", [{"commit": "abc", "action": "explode"}])
    assert response["status"] == 400
