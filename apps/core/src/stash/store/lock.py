"""Reentrant file-based write lock for STASH_HOME."""

import contextlib
import os
import sys
import threading
import time
from collections.abc import Generator
from contextlib import contextmanager
from pathlib import Path

from stash.errors import LockTimeout

_tls = threading.local()


def _is_pid_running(pid: int) -> bool:
    """Check if a process with given PID is currently active."""
    if pid <= 0:
        return False
    if sys.platform == "win32":
        import ctypes

        kernel32 = ctypes.windll.kernel32  # type: ignore[attr-defined]
        SYNCHRONIZE = 0x00100000
        handle = kernel32.OpenProcess(SYNCHRONIZE, False, pid)
        if handle:
            kernel32.CloseHandle(handle)
            return True
        return False
    else:
        try:
            os.kill(pid, 0)
            return True
        except OSError:
            return False


def _check_and_break_stale_lock(lock_path: Path, max_age: float = 300.0) -> bool:
    """Inspect existing lock file; break it if holder PID is dead or file is too old."""
    try:
        content = lock_path.read_text(encoding="utf-8").strip()
        parts = content.split(":")
        if len(parts) >= 2:
            pid = int(parts[0])
            ts = float(parts[1])
            # If creator process is gone or file is older than max_age
            if not _is_pid_running(pid) or (time.time() - ts > max_age):
                lock_path.unlink(missing_ok=True)
                return True
    except Exception:
        # If lock file cannot be parsed or read, treat as potentially corrupted/stale
        try:
            if time.time() - lock_path.stat().st_mtime > max_age:
                lock_path.unlink(missing_ok=True)
                return True
        except Exception:
            pass
    return False


@contextmanager
def write_lock(home: Path, timeout: float = 30.0) -> Generator[None]:
    """Acquire an exclusive, reentrant lock on STASH_HOME/.lock.

    Raises LockTimeout if another process holds the lock for more than `timeout` seconds.
    """
    home = Path(home)
    home.mkdir(parents=True, exist_ok=True)
    lock_path = home / ".lock"

    # Thread-local reentrancy tracking
    current_depth = getattr(_tls, "depth", 0)
    current_home = getattr(_tls, "home", None)

    if current_depth > 0 and current_home == str(lock_path):
        _tls.depth = current_depth + 1
        try:
            yield
        finally:
            _tls.depth -= 1
        return

    # Outermost acquisition: acquire the file lock
    start_time = time.monotonic()
    fd = None
    poll_interval = 0.05

    while True:
        try:
            fd = os.open(
                str(lock_path),
                os.O_CREAT | os.O_EXCL | os.O_RDWR,
            )
            break
        except FileExistsError:
            _check_and_break_stale_lock(lock_path)

            elapsed = time.monotonic() - start_time
            if elapsed >= timeout:
                raise LockTimeout(
                    f"Lock held by another process on {lock_path} (timed out after {timeout:.1f}s)"
                ) from None

            time.sleep(poll_interval)
            poll_interval = min(poll_interval * 1.5, 0.5)

    try:
        # Write PID and timestamp
        lock_info = f"{os.getpid()}:{time.time()}\n"
        os.write(fd, lock_info.encode("utf-8"))
        os.close(fd)
        fd = None

        _tls.depth = 1
        _tls.home = str(lock_path)

        yield
    finally:
        _tls.depth = 0
        _tls.home = None
        if fd is not None:
            with contextlib.suppress(OSError):
                os.close(fd)
        with contextlib.suppress(OSError):
            lock_path.unlink(missing_ok=True)
