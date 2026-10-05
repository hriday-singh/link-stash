"""Error types shared by the CLI and the API. Skills branch on `code`."""


class StashError(Exception):
    def __init__(self, code: str, message: str, details: dict[str, object] | None = None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.details: dict[str, object] = details or {}

    def to_dict(self) -> dict[str, object]:
        return {"error": {"code": self.code, "message": self.message, "details": self.details}}


class NotFound(StashError):
    def __init__(self, message: str, details: dict[str, object] | None = None):
        super().__init__("not_found", message, details)


class Conflict(StashError):
    def __init__(self, message: str, details: dict[str, object] | None = None):
        super().__init__("conflict", message, details)


class Invalid(StashError):
    def __init__(self, message: str, details: dict[str, object] | None = None):
        super().__init__("invalid", message, details)


class LockTimeout(StashError):
    def __init__(self, message: str, details: dict[str, object] | None = None):
        super().__init__("lock_timeout", message, details)
