def test_list_remotes_empty(backend, git_repo):
    response = backend.list_remotes(str(git_repo))
    assert response["status"] == 200
    assert response["payload"]["remotes"] == []


def test_add_remote_then_list(backend, git_repo):
    add_response = backend.add_remote(str(git_repo), "origin", "https://example.com/repo.git")
    assert add_response["status"] == 200
    assert add_response["payload"]["remotes"] == [
        {
            "name": "origin",
            "fetch_url": "https://example.com/repo.git",
            "push_url": "https://example.com/repo.git",
        }
    ]


def test_add_remote_requires_name_and_url(backend, git_repo):
    assert backend.add_remote(str(git_repo), "", "https://example.com/repo.git")["status"] == 400
    assert backend.add_remote(str(git_repo), "origin", "")["status"] == 400


def test_remove_remote(backend, git_repo):
    backend.add_remote(str(git_repo), "origin", "https://example.com/repo.git")
    response = backend.remove_remote(str(git_repo), "origin")
    assert response["status"] == 200
    assert response["payload"]["remotes"] == []


def test_remove_remote_requires_name(backend, git_repo):
    assert backend.remove_remote(str(git_repo), "")["status"] == 400


def test_remove_remote_unknown_name_fails(backend, git_repo):
    response = backend.remove_remote(str(git_repo), "does-not-exist")
    assert response["status"] == 400


def test_create_repo(backend, tmp_path):
    response = backend.create_repo(str(tmp_path), "new-repo")
    assert response["status"] == 200
    created_path = response["payload"]["path"]
    assert (tmp_path / "new-repo" / ".git").is_dir()
    assert created_path == str((tmp_path / "new-repo").resolve())


def test_create_repo_requires_name(backend, tmp_path):
    response = backend.create_repo(str(tmp_path), "")
    assert response["status"] == 400


def test_create_repo_rejects_existing_path(backend, tmp_path):
    (tmp_path / "already-here").mkdir()
    response = backend.create_repo(str(tmp_path), "already-here")
    assert response["status"] == 400


def test_clone_repo_local_path(backend, git_repo, tmp_path):
    destination_parent = tmp_path / "clones"
    destination_parent.mkdir()
    response = backend.clone_repo(str(git_repo), str(destination_parent))
    assert response["status"] == 200
    cloned_path = response["payload"]["path"]
    assert (destination_parent / git_repo.name / ".git").is_dir()
    assert cloned_path == str((destination_parent / git_repo.name).resolve())


def test_clone_repo_requires_url(backend, tmp_path):
    response = backend.clone_repo("", str(tmp_path))
    assert response["status"] == 400


def test_clone_repo_rejects_existing_destination(backend, git_repo, tmp_path):
    destination_parent = tmp_path / "clones"
    destination_parent.mkdir()
    (destination_parent / git_repo.name).mkdir()
    response = backend.clone_repo(str(git_repo), str(destination_parent))
    assert response["status"] == 400


def test_clone_repo_custom_directory_name(backend, git_repo, tmp_path):
    response = backend.clone_repo(str(git_repo), str(tmp_path), "custom-name")
    assert response["status"] == 200
    assert (tmp_path / "custom-name" / ".git").is_dir()
