def test_unpushed_lists_every_commit_when_no_remote_exists(backend, git_repo, run_git):
    """A branch with no upstream has no @{u} to diff against, and that is
    precisely the case where every commit on it is unpushed."""
    for index in range(2):
        (git_repo / "file.txt").write_text("%d\n" % index)
        run_git(git_repo, "add", "file.txt")
        run_git(git_repo, "commit", "-m", "Change %d" % index)

    unpushed = backend.get_unpushed_commits(str(git_repo))

    # The initial commit from the fixture, plus the two above.
    assert len(unpushed) == 3
    assert all(len(sha) == 40 for sha in unpushed)


def test_unpushed_excludes_commits_a_remote_already_has(backend, tmp_path, git_repo, run_git):
    upstream = tmp_path / "upstream.git"
    run_git(git_repo, "init", "--bare", str(upstream))
    run_git(git_repo, "remote", "add", "origin", str(upstream))
    run_git(git_repo, "push", "-q", "origin", "master")

    assert backend.get_unpushed_commits(str(git_repo)) == []

    (git_repo / "file.txt").write_text("local only\n")
    run_git(git_repo, "add", "file.txt")
    run_git(git_repo, "commit", "-m", "Not pushed yet")

    unpushed = backend.get_unpushed_commits(str(git_repo))
    head = run_git(git_repo, "rev-parse", "HEAD").strip()
    assert unpushed == [head]


def test_unpushed_is_empty_outside_a_repo(backend, tmp_path):
    """rev-list fails outside a work tree; the caller gets a list, not a crash."""
    assert backend.get_unpushed_commits(str(tmp_path)) == []
