import os
import sys


def test_resolve_web_root_unfrozen_walks_up_from_script_path(backend, monkeypatch):
    fake_argv0 = os.path.join("some", "prefix", "bin", "gitpar")
    monkeypatch.setattr(sys, "argv", [fake_argv0])
    monkeypatch.setattr(sys, "frozen", False, raising=False)

    web_root = backend.resolve_web_root()

    assert web_root.endswith(os.path.join("prefix", "share", "gitpar", "web"))


def test_resolve_web_root_frozen_uses_meipass(backend, monkeypatch, tmp_path):
    monkeypatch.setattr(sys, "frozen", True, raising=False)
    monkeypatch.setattr(sys, "_MEIPASS", str(tmp_path), raising=False)

    web_root = backend.resolve_web_root()

    assert web_root == os.path.join(str(tmp_path), "share", "gitpar", "web")
