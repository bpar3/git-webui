def _repo_with_bare_remote(tmp_path, git_repo, run_git):
    upstream = tmp_path / "upstream.git"
    run_git(git_repo, "init", "--bare", str(upstream))
    run_git(git_repo, "remote", "add", "origin", str(upstream))
    run_git(git_repo, "push", "-q", "origin", "master")
    return upstream


def test_delete_remote_branch_removes_it_from_the_remote(backend, tmp_path, git_repo, run_git):
    upstream = _repo_with_bare_remote(tmp_path, git_repo, run_git)
    run_git(git_repo, "checkout", "-b", "feature")
    run_git(git_repo, "push", "-q", "origin", "feature")
    assert "feature" in run_git(git_repo, "ls-remote", "--heads", str(upstream))

    response = backend.delete_remote_branch(str(git_repo), "origin/feature")

    assert response["status"] == 200
    assert "feature" not in run_git(git_repo, "ls-remote", "--heads", str(upstream))


def test_delete_remote_branch_reports_the_result_in_the_refreshed_branch_list(backend, tmp_path, git_repo, run_git):
    _repo_with_bare_remote(tmp_path, git_repo, run_git)
    run_git(git_repo, "checkout", "-b", "feature")
    run_git(git_repo, "push", "-q", "origin", "feature")
    run_git(git_repo, "checkout", "master")

    response = backend.delete_remote_branch(str(git_repo), "origin/feature")

    remote_names = [b["remote_name"] for b in response["payload"]["branches"] if b["remote_name"]]
    assert "origin/feature" not in remote_names


def test_delete_remote_branch_leaves_the_local_branch_alone(backend, tmp_path, git_repo, run_git):
    """Deleting the remote ref is independent of the local branch - the
    local branch (and any local checkout of it) survives untouched."""
    _repo_with_bare_remote(tmp_path, git_repo, run_git)
    run_git(git_repo, "checkout", "-b", "feature")
    run_git(git_repo, "push", "-q", "origin", "feature")

    response = backend.delete_remote_branch(str(git_repo), "origin/feature")

    assert response["status"] == 200
    assert backend.get_current_branch_name(str(git_repo)) == "feature"
    local_names = [b["local_name"] for b in response["payload"]["branches"] if b["local_name"]]
    assert "feature" in local_names


def test_delete_remote_branch_requires_a_remote_qualified_name(backend, git_repo):
    assert backend.delete_remote_branch(str(git_repo), "feature")["status"] == 400
    assert backend.delete_remote_branch(str(git_repo), "")["status"] == 400
    assert backend.delete_remote_branch(str(git_repo), None)["status"] == 400


def test_delete_remote_branch_reports_failure_for_an_unknown_remote(backend, git_repo):
    response = backend.delete_remote_branch(str(git_repo), "does-not-exist/feature")
    assert response["status"] == 400
    assert "error" in response["payload"]


def test_delete_remote_branch_splits_only_on_the_first_slash(backend, tmp_path, git_repo, run_git):
    """A branch name with its own slash (feature/x) must not be mistaken
    for part of the remote name."""
    _repo_with_bare_remote(tmp_path, git_repo, run_git)
    run_git(git_repo, "checkout", "-b", "feature/nested")
    run_git(git_repo, "push", "-q", "origin", "feature/nested")

    response = backend.delete_remote_branch(str(git_repo), "origin/feature/nested")

    assert response["status"] == 200
    remote_names = [b["remote_name"] for b in response["payload"]["branches"] if b["remote_name"]]
    assert "origin/feature/nested" not in remote_names
