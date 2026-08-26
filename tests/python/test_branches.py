def test_parse_track_details_empty(backend):
    assert backend.parse_track_details("") == (0, 0)
    assert backend.parse_track_details(None) == (0, 0)


def test_parse_track_details_ahead_only(backend):
    assert backend.parse_track_details("[ahead 3]") == (3, 0)


def test_parse_track_details_ahead_and_behind(backend):
    assert backend.parse_track_details("[ahead 2, behind 5]") == (2, 5)


def test_parse_for_each_ref_line_pads_missing_fields(backend):
    entry = backend.parse_for_each_ref_line("devel\t*\t")
    assert entry == {
        "name": "devel",
        "is_current": True,
        "upstream": "",
        "track": "",
        "date": "",
        "subject": "",
        "commit": "",
        "full_name": "",
    }


def test_parse_for_each_ref_line_full(backend):
    entry = backend.parse_for_each_ref_line(
        "devel\t\torigin/devel\t[ahead 1]\t3 hours ago\tSome subject\tabc123def456\trefs/heads/devel"
    )
    assert entry["name"] == "devel"
    assert entry["is_current"] is False
    assert entry["upstream"] == "origin/devel"
    assert entry["track"] == "[ahead 1]"
    assert entry["subject"] == "Some subject"
    assert entry["commit"] == "abc123def456"
    assert entry["full_name"] == "refs/heads/devel"


def test_get_branch_entries_excludes_remote_head_symref(backend, git_repo, tmp_path):
    clone_path = tmp_path / "clone"
    backend.run_command_capture(["git", "clone", str(git_repo), str(clone_path)])
    branches = backend.get_branch_entries(str(clone_path))
    names = [b["display_name"] for b in branches]
    assert "origin" not in names
    assert "origin/master" in names or any(b["remote_name"] == "origin/master" for b in branches)


def test_get_branch_entries_single_local_branch(backend, git_repo):
    branches = backend.get_branch_entries(str(git_repo))
    assert len(branches) == 1
    assert branches[0]["local_name"] == "master"
    assert branches[0]["current"] is True
    assert branches[0]["status"] == "local-only"
    assert branches[0]["can_delete"] is False
    assert len(branches[0]["commit"]) == 40


def test_create_branch_and_checkout(backend, git_repo):
    response = backend.create_branch(str(git_repo), "feature", "master", True)
    assert response["status"] == 200
    names = [b["local_name"] for b in response["payload"]["branches"]]
    assert "feature" in names
    current = backend.get_current_branch_name(str(git_repo))
    assert current == "feature"


def test_create_branch_requires_name(backend, git_repo):
    response = backend.create_branch(str(git_repo), "  ", "master", True)
    assert response["status"] == 400


def test_delete_branch_removes_non_current_branch(backend, git_repo):
    backend.create_branch(str(git_repo), "feature", "master", False)
    response = backend.delete_branch(str(git_repo), "feature", False)
    assert response["status"] == 200
    names = [b["local_name"] for b in response["payload"]["branches"]]
    assert "feature" not in names


def test_checkout_branch_switches_current(backend, git_repo):
    backend.create_branch(str(git_repo), "feature", "master", False)
    response = backend.checkout_branch(str(git_repo), "feature", None)
    assert response["status"] == 200
    assert backend.get_current_branch_name(str(git_repo)) == "feature"


def test_compare_branches_reports_diff(backend, git_repo):
    backend.create_branch(str(git_repo), "feature", "master", True)
    (git_repo / "README.md").write_text("hello\nworld\n")
    backend.run_git_capture(str(git_repo), ["add", "README.md"])
    backend.run_git_capture(str(git_repo), ["commit", "-m", "Add a line"])

    response = backend.compare_branches(str(git_repo), "feature", "master")
    assert response["status"] == 200
    assert "README.md" in response["payload"]["summary"]


def test_compare_branches_requires_source(backend, git_repo):
    response = backend.compare_branches(str(git_repo), "", "master")
    assert response["status"] == 400


def test_is_ancestor_of_head_true_for_head_itself(backend, git_repo):
    head = backend.get_current_branch_name(str(git_repo))
    sha = backend.run_git_capture(str(git_repo), ["rev-parse", "HEAD"])["stdout"].strip()
    assert backend.is_ancestor_of_head(str(git_repo), sha) is True


def test_is_ancestor_of_head_false_for_divergent_commit(backend, git_repo):
    backend.create_branch(str(git_repo), "feature", "master", True)
    (git_repo / "feature.txt").write_text("new file\n")
    backend.run_git_capture(str(git_repo), ["add", "feature.txt"])
    backend.run_git_capture(str(git_repo), ["commit", "-m", "Add feature file"])
    feature_sha = backend.run_git_capture(str(git_repo), ["rev-parse", "HEAD"])["stdout"].strip()
    backend.run_git_capture(str(git_repo), ["checkout", "master"])

    assert backend.is_ancestor_of_head(str(git_repo), feature_sha) is False


def test_is_ancestor_of_head_false_for_empty_commit(backend, git_repo):
    assert backend.is_ancestor_of_head(str(git_repo), "") is False


def test_merge_branch_fast_forwards(backend, git_repo):
    backend.create_branch(str(git_repo), "feature", "master", True)
    (git_repo / "feature.txt").write_text("new file\n")
    backend.run_git_capture(str(git_repo), ["add", "feature.txt"])
    backend.run_git_capture(str(git_repo), ["commit", "-m", "Add feature file"])
    backend.run_git_capture(str(git_repo), ["checkout", "master"])

    response = backend.merge_branch(str(git_repo), "feature", "master", False)
    assert response["status"] == 200
    assert (git_repo / "feature.txt").exists()


def _run(repo, *args):
    import subprocess
    subprocess.run(["git"] + list(args), cwd=str(repo), check=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def test_get_tag_entries_empty_repo_has_no_tags(backend, git_repo):
    assert backend.get_tag_entries(str(git_repo)) == []


def test_get_tag_entries_lightweight_tag(backend, git_repo):
    _run(git_repo, "tag", "v1.0")
    tags = backend.get_tag_entries(str(git_repo))
    assert len(tags) == 1
    assert tags[0]["name"] == "v1.0"
    assert tags[0]["annotated"] is False
    assert len(tags[0]["commit"]) == 40


def test_get_tag_entries_annotated_tag_resolves_to_the_commit(backend, git_repo):
    """An annotated tag's own objectname is the tag object, not the commit -
    the entry must carry the commit so it can be placed in the graph."""
    _run(git_repo, "tag", "-a", "v2.0", "-m", "release")
    head = backend.run_git_capture(str(git_repo), ["rev-parse", "HEAD"])["stdout"].strip()
    tags = backend.get_tag_entries(str(git_repo))
    assert len(tags) == 1
    assert tags[0]["name"] == "v2.0"
    assert tags[0]["annotated"] is True
    assert tags[0]["commit"] == head


def test_get_branch_entries_exposes_remote_commit(backend, git_repo):
    entries = backend.get_branch_entries(str(git_repo))
    assert len(entries) == 1
    # No upstream configured, so there is no remote tip to report.
    assert entries[0]["remote_commit"] is None
