import json


def test_theme_defaults_to_light(backend, handler_state):
    assert backend.GitParRequestHandler.THEME == "light"


def test_set_theme_persists_across_a_restart(backend, handler_state, tmp_path):
    """The preference has to outlive the process - that is the whole point
    of not keeping it in the browser."""
    handler = backend.GitParRequestHandler
    handler.set_theme("dark")

    state = json.loads(open(handler.APP_STATE_PATH).read())
    assert state["theme"] == "dark"

    # A fresh start reads the same file back.
    handler.THEME = "light"
    handler.load_state()
    assert handler.THEME == "dark"


def test_set_theme_rejects_anything_but_dark(backend, handler_state):
    handler = backend.GitParRequestHandler
    handler.set_theme("dark")
    handler.set_theme("neon")
    assert handler.THEME == "light"
    handler.set_theme(None)
    assert handler.THEME == "light"


def test_load_state_without_a_theme_falls_back_to_light(backend, handler_state):
    """State files written before the theme was stored have no such key."""
    handler = backend.GitParRequestHandler
    with open(handler.APP_STATE_PATH, "w") as state_file:
        json.dump({"recent_repos": [], "open_repos": []}, state_file)
    handler.THEME = "dark"
    handler.load_state()
    assert handler.THEME == "light"


def test_corrupt_state_does_not_leave_the_theme_undefined(backend, handler_state):
    handler = backend.GitParRequestHandler
    with open(handler.APP_STATE_PATH, "w") as state_file:
        state_file.write("{not json")
    handler.load_state()
    assert handler.THEME == "light"
