import os


def test_list_stored_credentials_empty_when_file_missing(backend, git_repo, monkeypatch, tmp_path):
    # Isolated from the real ~/.git-credentials, which may genuinely
    # exist and have entries on whatever machine runs this suite.
    monkeypatch.setattr(os.path, "expanduser", lambda p: p.replace("~", str(tmp_path / "empty-home")))

    result = backend.list_stored_credentials(str(git_repo))
    assert result["status"] == 200
    assert result["payload"]["entries"] == []


def test_list_stored_credentials_parses_default_file(backend, git_repo, monkeypatch, tmp_path):
    store_file = tmp_path / "home" / ".git-credentials"
    store_file.parent.mkdir()
    store_file.write_text("https://alice:s3cret@github.com\nhttps://bob@example.com/repo\n")
    monkeypatch.setattr(os.path, "expanduser", lambda p: p.replace("~", str(tmp_path / "home")))

    result = backend.list_stored_credentials(str(git_repo))

    assert result["status"] == 200
    entries = result["payload"]["entries"]
    assert {"protocol": "https", "host": "github.com", "username": "alice"} in entries
    assert {"protocol": "https", "host": "example.com", "username": "bob"} in entries
    # The password is never present anywhere in the response.
    assert "s3cret" not in str(result["payload"])


def test_list_stored_credentials_respects_custom_file_path(backend, git_repo, run_git, tmp_path):
    custom_path = tmp_path / "custom-credentials"
    custom_path.write_text("https://carol@gitlab.com\n")
    run_git(git_repo, "config", "credential.helper", "store --file=%s" % custom_path)

    result = backend.list_stored_credentials(str(git_repo))

    assert result["payload"]["path"] == str(custom_path)
    assert result["payload"]["entries"] == [{"protocol": "https", "host": "gitlab.com", "username": "carol"}]


def test_list_stored_credentials_decodes_percent_encoded_usernames(backend, git_repo, run_git, tmp_path):
    custom_path = tmp_path / "custom-credentials"
    custom_path.write_text("https://user%40example.com@bitbucket.org\n")
    run_git(git_repo, "config", "credential.helper", "store --file=%s" % custom_path)

    result = backend.list_stored_credentials(str(git_repo))

    assert result["payload"]["entries"] == [
        {"protocol": "https", "host": "bitbucket.org", "username": "user@example.com"}
    ]


def test_list_stored_credentials_ignores_blank_lines(backend, git_repo, run_git, tmp_path):
    custom_path = tmp_path / "custom-credentials"
    custom_path.write_text("\nhttps://dave@example.com\n\n")
    run_git(git_repo, "config", "credential.helper", "store --file=%s" % custom_path)

    result = backend.list_stored_credentials(str(git_repo))

    assert len(result["payload"]["entries"]) == 1
