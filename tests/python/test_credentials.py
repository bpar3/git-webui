import http.server
import threading
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeoutError


def test_base_git_env_disables_terminal_prompt(backend):
    env = backend.base_git_env()
    assert env["GIT_TERMINAL_PROMPT"] == "0"


class _AuthRequiredHandler(http.server.BaseHTTPRequestHandler):
    """A bare-minimum server that always demands Basic auth, so a git
    client probing it always needs a credential it doesn't have."""

    def do_GET(self):
        self.send_response(401)
        self.send_header("WWW-Authenticate", 'Basic realm="test"')
        self.end_headers()

    def log_message(self, *args):
        pass


def _start_auth_required_server():
    server = http.server.HTTPServer(("127.0.0.1", 0), _AuthRequiredHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server


def test_run_git_capture_fails_fast_instead_of_hanging_on_credential_prompt(backend, tmp_path):
    # Without GIT_TERMINAL_PROMPT=0, git would block on stdin waiting for
    # a username - forever, since nothing here is a real terminal. Bound
    # the wait so a regression fails the test instead of hanging the
    # whole suite.
    server = _start_auth_required_server()
    try:
        url = "http://127.0.0.1:%d/repo.git" % server.server_address[1]
        with ThreadPoolExecutor(max_workers=1) as pool:
            future = pool.submit(backend.run_git_capture, str(tmp_path), ["ls-remote", url])
            try:
                result = future.result(timeout=5)
            except FutureTimeoutError:
                raise AssertionError(
                    "run_git_capture hung waiting for a credential prompt - "
                    "GIT_TERMINAL_PROMPT is not reaching the git subprocess"
                )
        assert result["returncode"] != 0
        assert "terminal prompts disabled" in result["stderr"]
    finally:
        server.shutdown()


def test_run_command_capture_also_disables_terminal_prompt(backend, tmp_path):
    server = _start_auth_required_server()
    try:
        url = "http://127.0.0.1:%d/repo.git" % server.server_address[1]
        with ThreadPoolExecutor(max_workers=1) as pool:
            future = pool.submit(
                backend.run_command_capture, ["git", "ls-remote", url]
            )
            try:
                result = future.result(timeout=5)
            except FutureTimeoutError:
                raise AssertionError(
                    "run_command_capture hung waiting for a credential prompt - "
                    "GIT_TERMINAL_PROMPT is not reaching the git subprocess"
                )
        assert result["returncode"] != 0
        assert "terminal prompts disabled" in result["stderr"]
    finally:
        server.shutdown()
