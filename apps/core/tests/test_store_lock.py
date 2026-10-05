"""Tests for reentrant write_lock in stash.store.lock."""

import os
import threading
from pathlib import Path

import pytest

from stash.errors import LockTimeout
from stash.store.lock import write_lock


def test_lock_acquire_and_release(tmp_path: Path) -> None:
    lock_file = tmp_path / ".lock"
    assert not lock_file.exists()

    with write_lock(tmp_path):
        assert lock_file.exists()
        content = lock_file.read_text(encoding="utf-8")
        assert str(os.getpid()) in content

    assert not lock_file.exists()


def test_lock_reentrancy_in_same_thread(tmp_path: Path) -> None:
    depth = 0
    with write_lock(tmp_path):
        depth += 1
        with write_lock(tmp_path):
            depth += 1
            assert depth == 2
            assert (tmp_path / ".lock").exists()

    assert not (tmp_path / ".lock").exists()


def test_lock_contention_timeout(tmp_path: Path) -> None:
    lock_acquired_event = threading.Event()
    release_event = threading.Event()
    contention_timeout_occurred = threading.Event()

    def holder() -> None:
        with write_lock(tmp_path):
            lock_acquired_event.set()
            release_event.wait(timeout=2.0)

    t = threading.Thread(target=holder)
    t.start()

    try:
        assert lock_acquired_event.wait(timeout=1.0)
        with (
            pytest.raises(LockTimeout, match="Lock held by another process"),
            write_lock(tmp_path, timeout=0.15),
        ):
            pass
        contention_timeout_occurred.set()
    finally:
        release_event.set()
        t.join(timeout=2.0)

    assert contention_timeout_occurred.is_set()
    assert not (tmp_path / ".lock").exists()


def test_stale_lock_recovery(tmp_path: Path) -> None:
    lock_file = tmp_path / ".lock"
    # Write a stale lock with dead PID 999999 and timestamp in past
    lock_file.write_text("999999:100000.0\n", encoding="utf-8")

    # Should break stale lock and succeed
    with write_lock(tmp_path, timeout=0.5):
        assert lock_file.exists()
        assert str(os.getpid()) in lock_file.read_text(encoding="utf-8")

    assert not lock_file.exists()
