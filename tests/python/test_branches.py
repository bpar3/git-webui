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
    }


def test_parse_for_each_ref_line_full(backend):
    entry = backend.parse_for_each_ref_line(
        "devel\t\torigin/devel\t[ahead 1]\t3 hours ago\tSome subject"
    )
    assert entry["name"] == "devel"
    assert entry["is_current"] is False
    assert entry["upstream"] == "origin/devel"
    assert entry["track"] == "[ahead 1]"
    assert entry["subject"] == "Some subject"


def test_get_branch_entries_single_local_branch(backend, git_repo):
    branches = backend.get_branch_entries(str(git_repo))
    assert len(branches) == 1
    assert branches[0]["local_name"] == "master"
    assert branches[0]["current"] is True
    assert branches[0]["status"] == "local-only"
    assert branches[0]["can_delete"] is False


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


def test_merge_branch_fast_forwards(backend, git_repo):
    backend.create_branch(str(git_repo), "feature", "master", True)
    (git_repo / "feature.txt").write_text("new file\n")
    backend.run_git_capture(str(git_repo), ["add", "feature.txt"])
    backend.run_git_capture(str(git_repo), ["commit", "-m", "Add feature file"])
    backend.run_git_capture(str(git_repo), ["checkout", "master"])

    response = backend.merge_branch(str(git_repo), "feature", "master", False)
    assert response["status"] == 200
    assert (git_repo / "feature.txt").exists()
