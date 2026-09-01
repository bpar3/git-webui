import json
import os
import subprocess
import sys
import threading
import urllib.error
import urllib.request
from pathlib import Path

BACKEND_SCRIPT = Path(__file__).resolve().parents[2] / "src" / "bin" / "gitpar"


def _url(port, path):
    return "http://127.0.0.1:%d%s" % (port, path)


def _post_json(port, path, payload):
    data = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(_url(port, path), data=data, method="POST")
    request.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(request) as response:
            return response.status, json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        return error.code, json.loads(error.read().decode("utf-8"))


def _get_json(port, path):
    with urllib.request.urlopen(_url(port, path)) as response:
        return json.loads(response.read().decode("utf-8"))


def test_pending_reports_nothing_when_no_prompt_is_waiting(live_server):
    assert _get_json(live_server, "/api/askpass/pending") == {"id": None, "prompt": None}


def test_request_blocks_until_answered_then_the_answer_reaches_the_waiting_caller(live_server):
    """/api/askpass/request is what the askpass helper subprocess calls -
    it blocks (see wait_for_askpass_answer) until /api/askpass/answer
    supplies a value. Simulates the helper with a background thread
    making that same blocking call, and confirms: (1) it shows up via
    /api/askpass/pending while waiting, (2) submitting an answer both
    unblocks it and delivers the exact value, (3) it's gone from pending
    afterwards."""
    result = {}

    def blocked_request():
        status, body = _post_json(live_server, "/api/askpass/request", {"prompt": "Password for 'https://x': "})
        result["status"] = status
        result["value"] = body.get("value")

    thread = threading.Thread(target=blocked_request)
    thread.start()
    try:
        pending = None
        for _ in range(50):
            pending = _get_json(live_server, "/api/askpass/pending")
            if pending.get("id"):
                break
            threading.Event().wait(0.05)
        assert pending["id"] is not None
        assert pending["prompt"] == "Password for 'https://x': "

        status, answer_body = _post_json(live_server, "/api/askpass/answer", {"id": pending["id"], "value": "hunter2"})
        assert status == 200
    finally:
        thread.join(timeout=10)

    assert not thread.is_alive()
    assert result["value"] == "hunter2"
    assert _get_json(live_server, "/api/askpass/pending") == {"id": None, "prompt": None}


def test_answering_an_unknown_id_returns_404(live_server):
    status, body = _post_json(live_server, "/api/askpass/answer", {"id": "not-a-real-id", "value": "x"})
    assert status == 404


def test_askpass_helper_subprocess_prints_the_answer_it_receives(live_server):
    """The full path git itself would exercise: GITPAR_ASKPASS_MODE=1 +
    GITPAR_ASKPASS_PORT set, this script re-invoked with the prompt text
    as argv[1], exactly the way GIT_ASKPASS/SSH_ASKPASS are called."""
    env = dict(os.environ)
    env["GITPAR_ASKPASS_MODE"] = "1"
    env["GITPAR_ASKPASS_PORT"] = str(live_server)

    process = subprocess.Popen(
        [sys.executable, str(BACKEND_SCRIPT), "Username for 'https://example.com': "],
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )

    pending = None
    for _ in range(50):
        pending = _get_json(live_server, "/api/askpass/pending")
        if pending.get("id"):
            break
        threading.Event().wait(0.05)
    assert pending["id"] is not None
    assert pending["prompt"] == "Username for 'https://example.com': "

    _post_json(live_server, "/api/askpass/answer", {"id": pending["id"], "value": "octocat"})

    stdout, stderr = process.communicate(timeout=10)
    assert process.returncode == 0, stderr
    assert stdout == "octocat"


def test_askpass_helper_fails_without_a_port(tmp_path):
    env = dict(os.environ)
    env["GITPAR_ASKPASS_MODE"] = "1"
    env.pop("GITPAR_ASKPASS_PORT", None)

    process = subprocess.run(
        [sys.executable, str(BACKEND_SCRIPT), "Password: "],
        env=env,
        cwd=str(tmp_path),
        capture_output=True,
        text=True,
        timeout=10,
    )
    assert process.returncode != 0
