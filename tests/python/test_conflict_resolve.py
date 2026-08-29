import os


def _conflicted(repo, run_git):
    """Leave the repo mid-merge with one conflicted file."""
    (repo / "file.txt").write_text("base\n")
    run_git(repo, "add", "file.txt")
    run_git(repo, "commit", "-m", "Base")
    run_git(repo, "checkout", "-b", "feature")
    (repo / "file.txt").write_text("theirs\n")
    run_git(repo, "commit", "-am", "Theirs")
    run_git(repo, "checkout", "master")
    (repo / "file.txt").write_text("ours\n")
    run_git(repo, "commit", "-am", "Ours")
    # merge exits non-zero on conflict, which is the point
    os.system("cd %s && git merge feature >/dev/null 2>&1" % repo)
    return repo


def test_parse_splits_context_from_each_side(backend):
    segments = backend.parse_conflict_segments(
        "shared before\n"
        "<<<<<<< HEAD\n"
        "our line\n"
        "=======\n"
        "their line\n"
        ">>>>>>> feature\n"
        "shared after\n"
    )
    kinds = [segment["kind"] for segment in segments]
    assert kinds == ["context", "conflict", "context"]
    assert segments[0]["lines"] == ["shared before"]
    assert segments[1]["ours"] == ["our line"]
    assert segments[1]["theirs"] == ["their line"]
    assert segments[1]["ours_label"] == "HEAD"
    assert segments[1]["theirs_label"] == "feature"
    assert segments[2]["lines"] == ["shared after", ""]


def test_parse_keeps_the_merge_base_out_of_both_sides(backend):
    """diff3 conflicts carry the base between ||||||| and =======."""
    segments = backend.parse_conflict_segments(
        "<<<<<<< HEAD\n"
        "our line\n"
        "||||||| merged common ancestors\n"
        "original line\n"
        "=======\n"
        "their line\n"
        ">>>>>>> feature\n"
    )
    conflict = segments[0]
    assert conflict["ours"] == ["our line"]
    assert conflict["base"] == ["original line"]
    assert conflict["theirs"] == ["their line"]


def test_parse_handles_a_file_with_no_conflict(backend):
    segments = backend.parse_conflict_segments("just\ntwo lines\n")
    assert [s["kind"] for s in segments] == ["context"]
    assert segments[0]["lines"] == ["just", "two lines", ""]


def test_parse_keeps_an_unterminated_conflict(backend):
    """Malformed markers must not silently swallow the file's content."""
    segments = backend.parse_conflict_segments("<<<<<<< HEAD\nour line\n")
    assert segments[0]["kind"] == "conflict"
    assert segments[0]["ours"] == ["our line", ""]


def test_get_conflict_file_reports_the_conflict(backend, git_repo, run_git):
    _conflicted(git_repo, run_git)
    result = backend.get_conflict_file(str(git_repo), "file.txt")
    assert result["status"] == 200
    assert result["payload"]["conflicted"] is True
    conflict = [s for s in result["payload"]["segments"] if s["kind"] == "conflict"][0]
    assert conflict["ours"] == ["ours"]
    assert conflict["theirs"] == ["theirs"]


def test_get_conflict_file_rejects_a_path_outside_the_repo(backend, git_repo):
    result = backend.get_conflict_file(str(git_repo), "../../../etc/passwd")
    assert result["status"] == 400
    assert "Invalid file path" in result["payload"]["error"]


def test_get_conflict_file_refuses_binary(backend, git_repo):
    (git_repo / "blob.bin").write_bytes(b"\x00\x01\x02")
    result = backend.get_conflict_file(str(git_repo), "blob.bin")
    assert result["status"] == 400
    assert "binary" in result["payload"]["error"].lower()


def test_save_resolved_writes_and_stages(backend, git_repo, run_git):
    _conflicted(git_repo, run_git)
    result = backend.save_resolved_file(str(git_repo), "file.txt", "resolved\n", True)
    assert result["status"] == 200
    assert (git_repo / "file.txt").read_text() == "resolved\n"
    # staged means it is no longer listed as conflicted
    assert result["payload"]["conflicted_files"] == []


def test_save_resolved_can_skip_staging(backend, git_repo, run_git):
    _conflicted(git_repo, run_git)
    result = backend.save_resolved_file(str(git_repo), "file.txt", "resolved\n", False)
    assert result["status"] == 200
    assert (git_repo / "file.txt").read_text() == "resolved\n"
    assert result["payload"]["conflicted_files"] == ["file.txt"]


def test_save_resolved_rejects_a_path_outside_the_repo(backend, git_repo):
    result = backend.save_resolved_file(str(git_repo), "../escape.txt", "x", False)
    assert result["status"] == 400
