import json
import threading
import time


def test_save_is_atomic_no_reader_ever_sees_a_partial_file(backend, handler_state):
    """Two instances writing concurrently must never produce a file that is
    empty or unparseable to a third reader landing mid-write. This is what a
    read-modify-write done with open(path, "w") (which truncates first)
    could not guarantee."""
    handler = backend.GitParRequestHandler
    handler.set_theme("dark")

    stop = threading.Event()
    errors = []

    def hammer(theme):
        while not stop.is_set():
            handler.set_theme(theme)

    def read_repeatedly():
        while not stop.is_set():
            try:
                raw = open(handler.APP_STATE_PATH).read()
            except OSError:
                continue
            if raw == "":
                errors.append("empty read")
                continue
            try:
                json.loads(raw)
            except ValueError:
                errors.append("unparseable read: %r" % raw[:80])

    writers = [threading.Thread(target=hammer, args=(t,)) for t in ("dark", "light")]
    readers = [threading.Thread(target=read_repeatedly) for _ in range(3)]
    for thread in writers + readers:
        thread.start()
    time.sleep(1.0)
    stop.set()
    for thread in writers + readers:
        thread.join()

    assert errors == []


def test_a_write_from_one_instance_does_not_erase_another_instances_tabs(backend, handler_state):
    """The scenario that motivated this: instance A opens a repo, instance B
    (a second process, simulated here by writing to the state file directly
    and then calling into the class as if it were a fresh instance) opens a
    different repo. A's next save - for something unrelated, like the theme -
    must not wipe B's tab."""
    handler = backend.GitParRequestHandler

    handler.OPEN_REPOS = ["/repo/a"]
    handler.save_state("open_repos")

    # Simulate instance B: it loaded state when only "a" was open, then
    # opened "b" itself and saved.
    on_disk = json.loads(open(handler.APP_STATE_PATH).read())
    on_disk["open_repos"] = ["/repo/a", "/repo/b"]
    with open(handler.APP_STATE_PATH, "w") as state_file:
        json.dump(on_disk, state_file)

    # Instance A, still only knowing about "a", changes something unrelated.
    handler.set_theme("dark")

    state = json.loads(open(handler.APP_STATE_PATH).read())
    assert state["theme"] == "dark"
    assert state["open_repos"] == ["/repo/a", "/repo/b"], (
        "saving the theme must not touch open_repos - that field was never "
        "named in this save, so B's tab must survive even though A's own "
        "in-memory OPEN_REPOS never knew about it"
    )


def test_recent_repos_merge_rather_than_overwrite(backend, handler_state):
    """Recent-repo lists are the one field two instances can each extend
    independently and where dropping the other's entry would be pure loss,
    so a save merges instead of replacing."""
    handler = backend.GitParRequestHandler

    handler.RECENT_REPOS = ["/repo/a"]
    handler.save_state("recent_repos")

    on_disk = json.loads(open(handler.APP_STATE_PATH).read())
    on_disk["recent_repos"] = ["/repo/b", "/repo/a"]
    with open(handler.APP_STATE_PATH, "w") as state_file:
        json.dump(on_disk, state_file)

    handler.RECENT_REPOS = ["/repo/c", "/repo/a"]
    handler.save_state("recent_repos")

    state = json.loads(open(handler.APP_STATE_PATH).read())
    # This instance's order wins for its own entries; the other instance's
    # unique entry ("/repo/b") is kept rather than dropped.
    assert state["recent_repos"] == ["/repo/c", "/repo/a", "/repo/b"]


def test_merge_recent_caps_at_the_limit(backend, handler_state):
    handler = backend.GitParRequestHandler
    mine = ["/r%d" % i for i in range(6)]
    theirs = ["/o%d" % i for i in range(6)]
    merged = handler.merge_recent(mine, theirs, limit=10)
    assert len(merged) == 10
    assert merged[:6] == mine


def test_pull_strategy_persists_and_rejects_unknown_values(backend, handler_state):
    handler = backend.GitParRequestHandler
    handler.set_pull_strategy("rebase")
    assert handler.PULL_STRATEGY == "rebase"

    handler.PULL_STRATEGY = "ff"
    handler.load_state()
    assert handler.PULL_STRATEGY == "rebase"

    handler.set_pull_strategy("not-a-strategy")
    assert handler.PULL_STRATEGY == "ff"


def test_auto_fetch_persists_as_a_boolean(backend, handler_state):
    handler = backend.GitParRequestHandler
    handler.set_auto_fetch(True)
    assert handler.AUTO_FETCH is True

    handler.AUTO_FETCH = False
    handler.load_state()
    assert handler.AUTO_FETCH is True

    handler.set_auto_fetch(None)
    assert handler.AUTO_FETCH is False


def test_save_state_leaves_no_lock_file_behind_on_success(backend, handler_state):
    handler = backend.GitParRequestHandler
    handler.set_theme("dark")
    # The lock file may exist (it is not removed - only unlocked), but it
    # must not still be held: another save must be able to acquire it
    # promptly rather than hang.
    started = time.time()
    handler.set_theme("light")
    assert time.time() - started < 2.0


def test_a_bad_load_does_not_immortalise_itself_on_the_next_save(backend, handler_state):
    """Guards the old failure mode directly: load_state() resetting to
    defaults after a bad read used to become permanent as soon as anything
    called save_state(), because the whole document was rewritten from that
    reset memory - so a transient read glitch turned into permanent data
    loss for fields the save never meant to touch."""
    handler = backend.GitParRequestHandler
    handler.OPEN_REPOS = ["/repo/a"]
    handler.save_state("open_repos")

    # This instance suffers a bad read (a truncated file, a torn write it
    # raced with) and resets to defaults in memory.
    with open(handler.APP_STATE_PATH, "w") as state_file:
        state_file.write("")
    handler.load_state()
    assert handler.OPEN_REPOS == []

    # Before this instance saves anything, the file is repaired - by
    # another instance, or by this one recovering. Either way, good data
    # is on disk again.
    with open(handler.APP_STATE_PATH, "w") as state_file:
        json.dump({"open_repos": ["/repo/a"], "theme": "light"}, state_file)

    # This instance still (wrongly) believes nothing is open, but a save
    # naming only "theme" must not overwrite the now-good open_repos with
    # its stale empty belief.
    handler.set_theme("dark")
    state = json.loads(open(handler.APP_STATE_PATH).read())
    assert state["theme"] == "dark"
    assert state["open_repos"] == ["/repo/a"]


def test_opening_a_repo_in_one_instance_does_not_erase_another_instances_tab(backend, handler_state):
    """The scenario that motivated all of this: instance A opens repo r3,
    instance B (simulated by writing straight to the state file, as a
    second process would) has already opened repo r4. A's open must not
    wipe r4 - which a plain save_state("open_repos") did, because it
    offered A's own OPEN_REPOS (which has never heard of r4) as the new
    value for the whole field."""
    handler = backend.GitParRequestHandler
    # r1 is already open (as if from an earlier launch of this same
    # instance, restored via load_state() and persisted at the time).
    handler.open_repo("/repo/r1")
    handler.open_repo("/repo/r3")

    # Instance B opens r4 and saves.
    on_disk = json.loads(open(handler.APP_STATE_PATH).read())
    on_disk["open_repos"] = on_disk["open_repos"] + ["/repo/r4"]
    with open(handler.APP_STATE_PATH, "w") as state_file:
        json.dump(on_disk, state_file)

    # Instance A opens yet another repo, still only knowing about r1/r3.
    handler.open_repo("/repo/r5")

    state = json.loads(open(handler.APP_STATE_PATH).read())
    assert set(state["open_repos"]) == {"/repo/r1", "/repo/r3", "/repo/r4", "/repo/r5"}


def test_closing_a_repo_actually_removes_it_even_after_a_merge(backend, handler_state):
    """Closing a tab has to actually take effect - a plain union-merge
    (the fix used for recent_repos) would bring a closed tab straight
    back the moment the on-disk copy, saved before the close, was
    merged back in."""
    handler = backend.GitParRequestHandler
    handler.OPEN_REPOS = ["/repo/r1", "/repo/r2"]
    handler.save_open_repos_delta(add="/repo/r1")
    handler.save_open_repos_delta(add="/repo/r2")

    handler.close_repo("/repo/r1")

    state = json.loads(open(handler.APP_STATE_PATH).read())
    assert state["open_repos"] == ["/repo/r2"]


def test_closing_a_repo_is_not_undone_by_a_concurrent_add_of_something_else(backend, handler_state):
    handler = backend.GitParRequestHandler
    handler.OPEN_REPOS = ["/repo/r1", "/repo/r2"]
    handler.save_open_repos_delta(add="/repo/r1")
    handler.save_open_repos_delta(add="/repo/r2")

    # Instance B, concurrently, opens a third repo - unrelated to r1.
    on_disk = json.loads(open(handler.APP_STATE_PATH).read())
    on_disk["open_repos"] = on_disk["open_repos"] + ["/repo/r3"]
    with open(handler.APP_STATE_PATH, "w") as state_file:
        json.dump(on_disk, state_file)

    handler.close_repo("/repo/r1")

    state = json.loads(open(handler.APP_STATE_PATH).read())
    assert set(state["open_repos"]) == {"/repo/r2", "/repo/r3"}


def test_save_open_repos_delta_does_not_duplicate_an_already_open_repo(backend, handler_state):
    handler = backend.GitParRequestHandler
    handler.save_open_repos_delta(add="/repo/r1")
    handler.save_open_repos_delta(add="/repo/r1")
    state = json.loads(open(handler.APP_STATE_PATH).read())
    assert state["open_repos"] == ["/repo/r1"]


def test_save_open_repos_delta_removing_an_absent_repo_is_a_no_op(backend, handler_state):
    handler = backend.GitParRequestHandler
    handler.save_open_repos_delta(add="/repo/r1")
    handler.save_open_repos_delta(remove="/repo/does-not-exist")
    state = json.loads(open(handler.APP_STATE_PATH).read())
    assert state["open_repos"] == ["/repo/r1"]
