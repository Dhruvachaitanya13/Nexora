from typing import Any, Dict, Optional

class AppException(Exception):
    def __init__(self, message: str, status_code: int = 500, details: Optional[Dict] = None):
        self.message = message
        self.status_code = status_code
        self.details = details or {}

class NotFoundError(AppException):
    def __init__(self, resource: str, id: Any):
        super().__init__(f"{resource} '{id}' not found", 404)

class AuthError(AppException):
    def __init__(self, message: str = "Authentication failed"):
        super().__init__(message, 401)
