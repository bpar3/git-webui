import json
import os
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor

# The existing test suite calls backend business-logic functions
# (list_remotes, add_remote, ...) directly and never exercises do_GET/
# do_POST/process() themselves. That dispatch layer is exactly what the
# request-scoped repo_root refactor touched (apply_request_repo_context,
# ensure_repo_selected, get_repo_context, process() all changed shape),
# so it needs its own coverage here rather than relying on the rest of
# the suite as a regression net for it.


def _url(port, path):
    return "http://127.0.0.1:%d%s" % (port, path)


def _get_json(port, path):
    with urllib.request.urlopen(_url(port, path)) as response:
        return json.loads(response.read().decode("utf-8"))


def _post_json(port, path, payload):
    data = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(_url(port, path), data=data, method="POST")
    request.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(request) as response:
            return response.status, json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        return error.code, json.loads(error.read().decode("utf-8"))


def _post_git(port, args, repo=None):
    path = "/git" if not repo else "/git?repo=%s" % urllib.parse.quote(repo)
    request = urllib.request.Request(_url(port, path), data=args.encode("utf-8"), method="POST")
    with urllib.request.urlopen(request) as response:
        return response.read().decode("utf-8", errors="replace")


def test_context_reports_no_repo_selected(live_server):
    context = _get_json(live_server, "/api/context")
    assert context["has_repo"] is False
    assert context["repo_id"] is None


def test_select_repo_then_context_reflects_it(live_server, git_repo):
    status, result = _post_json(live_server, "/api/repos/select", {"path": str(git_repo)})
    assert status == 200
    assert result["has_repo"] is True
    assert result["repo_id"] == os.path.realpath(str(git_repo))

    context = _get_json(live_server, "/api/context")
    assert context["repo_id"] == os.path.realpath(str(git_repo))


def test_branches_endpoint_targets_the_repo_query_param(live_server, git_repo, second_git_repo, run_git):
    _post_json(live_server, "/api/repos/select", {"path": str(git_repo)})
    _post_json(live_server, "/api/repos/select", {"path": str(second_git_repo)})
    # second_git_repo is now the "default" active tab; git_repo is still
    # open as a background tab. Explicitly asking for git_repo via the
    # repo= param must not silently use the active one instead.
    run_git(git_repo, "branch", "only-in-first-repo")

    first_branches = _get_json(live_server, "/api/branches?repo=%s" % urllib.parse.quote(str(git_repo)))
    second_branches = _get_json(live_server, "/api/branches?repo=%s" % urllib.parse.quote(str(second_git_repo)))

    first_names = [b.get("local_name") for b in first_branches["branches"]]
    second_names = [b.get("local_name") for b in second_branches["branches"]]
    assert "only-in-first-repo" in first_names
    assert "only-in-first-repo" not in second_names


def test_git_endpoint_runs_against_the_requested_repo(live_server, git_repo, second_git_repo, run_git):
    _post_json(live_server, "/api/repos/select", {"path": str(git_repo)})
    _post_json(live_server, "/api/repos/select", {"path": str(second_git_repo)})
    run_git(git_repo, "commit", "--allow-empty", "-m", "only in first repo")

    output = _post_git(live_server, "log --oneline -n 1", repo=str(git_repo))
    assert "only in first repo" in output


def test_close_repo_activates_a_remaining_tab(live_server, git_repo, second_git_repo):
    _post_json(live_server, "/api/repos/select", {"path": str(git_repo)})
    _post_json(live_server, "/api/repos/select", {"path": str(second_git_repo)})

    status, result = _post_json(live_server, "/api/repos/close", {"repo_id": str(second_git_repo)})
    assert status == 200
    assert result["repo_id"] == os.path.realpath(str(git_repo))


def test_ensure_repo_selected_returns_409_with_no_repo(live_server):
    status, result = _post_json(live_server, "/api/branches/create", {"name": "x"})
    assert status == 409


def test_concurrent_requests_for_different_repos_never_cross_wires(live_server, git_repo, second_git_repo, run_git):
    """GitParHttpServer is threaded specifically so a live credential
    prompt on one request can be answered by a second request instead of
    freezing the whole server. That only works because each request now
    resolves its own repo_root as a local (apply_request_repo_context's
    return value) rather than reading the old shared, per-request-mutated
    GitParRequestHandler.REPO_ROOT class attribute - which two genuinely
    concurrent requests for two different repos would otherwise race,
    each liable to run its git command against whichever repo the other
    thread happened to have set at that instant.

    Distinguishing each repo by a commit message only it has, and firing
    many interleaved concurrent requests for both, is what actually
    exercises that race - a single request pair could pass by luck even
    with the old racy code, since threads aren't guaranteed to overlap."""
    _post_json(live_server, "/api/repos/select", {"path": str(git_repo)})
    _post_json(live_server, "/api/repos/select", {"path": str(second_git_repo)})
    run_git(git_repo, "commit", "--allow-empty", "-m", "MARKER-FIRST-REPO")
    run_git(second_git_repo, "commit", "--allow-empty", "-m", "MARKER-SECOND-REPO")

    def fetch_first():
        return _post_git(live_server, "log --oneline -n 1", repo=str(git_repo))

    def fetch_second():
        return _post_git(live_server, "log --oneline -n 1", repo=str(second_git_repo))

    jobs = ([fetch_first] * 20) + ([fetch_second] * 20)
    with ThreadPoolExecutor(max_workers=16) as pool:
        futures = [pool.submit(job) for job in jobs]
        results = [(job, future.result(timeout=10)) for job, future in zip(jobs, futures)]

    for job, output in results:
        if job is fetch_first:
            assert "MARKER-FIRST-REPO" in output
            assert "MARKER-SECOND-REPO" not in output
        else:
            assert "MARKER-SECOND-REPO" in output
            assert "MARKER-FIRST-REPO" not in output
