from datetime import datetime, timedelta
from typing import Optional, Any, Union, Dict, List, Tuple
from jose import JWTError, jwt, ExpiredSignatureError
from passlib.context import CryptContext
from passlib.hash import argon2
from fastapi import HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer, APIKeyHeader, HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr, validator
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.backends import default_backend
import secrets
import hashlib
import hmac
import base64
import re
import pyotp
import qrcode
import io
import logging
from enum import Enum
from dataclasses import dataclass
from functools import wraps
import time
import uuid

from app.core.config import settings

logger = logging.getLogger(__name__)


class TokenType(str, Enum):
    ACCESS = "access"
    REFRESH = "refresh"
    PASSWORD_RESET = "password_reset"
    EMAIL_VERIFICATION = "email_verification"
    API_KEY = "api_key"
    TWO_FACTOR = "two_factor"


class TokenPayload(BaseModel):
    sub: str
    exp: datetime
    iat: datetime
    jti: str
    type: TokenType
    scopes: List[str] = []
    device_id: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None


class TokenData(BaseModel):
    user_id: str
    token_type: TokenType
    scopes: List[str] = []
    jti: str


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    refresh_expires_in: int
    scope: str = ""


class PasswordStrength(BaseModel):
    score: int
    feedback: List[str]
    is_strong: bool
    crack_time_display: str


@dataclass
class SecurityContext:
    user_id: str
    ip_address: str
    user_agent: str
    device_id: Optional[str]
    session_id: Optional[str]
    timestamp: datetime
    request_id: str


pwd_context = CryptContext(
    schemes=["argon2", "bcrypt"],
    default="argon2",
    deprecated="auto",
    argon2__memory_cost=65536,
    argon2__time_cost=3,
    argon2__parallelism=4,
    bcrypt__rounds=settings.security.BCRYPT_ROUNDS,
)


oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_PREFIX}/auth/login",
    auto_error=False,
    scopes={
        "read": "Read access to resources",
        "write": "Write access to resources",
        "admin": "Administrative access",
        "ai": "Access to AI features",
        "export": "Export data",
        "api": "API access",
    },
)


api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)
bearer_scheme = HTTPBearer(auto_error=False)


class EncryptionService:
    def __init__(self, key: Optional[str] = None):
        self._key = key or settings.security.ENCRYPTION_KEY
        self._fernet = self._create_fernet()
    
    def _create_fernet(self) -> Fernet:
        key_bytes = self._key.encode()
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=b"fintrack_salt_v1",
            iterations=100000,
            backend=default_backend()
        )
        derived_key = base64.urlsafe_b64encode(kdf.derive(key_bytes))
        return Fernet(derived_key)
    
    def encrypt(self, data: str) -> str:
        return self._fernet.encrypt(data.encode()).decode()
    
    def decrypt(self, encrypted_data: str) -> str:
        return self._fernet.decrypt(encrypted_data.encode()).decode()
    
    def encrypt_dict(self, data: Dict[str, Any]) -> str:
        import json
        return self.encrypt(json.dumps(data))
    
    def decrypt_dict(self, encrypted_data: str) -> Dict[str, Any]:
        import json
        return json.loads(self.decrypt(encrypted_data))


encryption_service = EncryptionService()


def create_access_token(
    subject: Union[str, Any],
    expires_delta: Optional[timedelta] = None,
    scopes: List[str] = None,
    additional_claims: Optional[Dict[str, Any]] = None,
    device_id: Optional[str] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> str:
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.security.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    jti = secrets.token_urlsafe(32)
    
    to_encode = {
        "sub": str(subject),
        "exp": expire,
        "iat": datetime.utcnow(),
        "jti": jti,
        "type": TokenType.ACCESS.value,
        "scopes": scopes or ["read", "write"],
    }
    
    if device_id:
        to_encode["device_id"] = device_id
    if ip_address:
        to_encode["ip_address"] = ip_address
    if user_agent:
        to_encode["user_agent"] = hashlib.sha256(user_agent.encode()).hexdigest()[:16]
    
    if additional_claims:
        to_encode.update(additional_claims)
    
    encoded_jwt = jwt.encode(
        to_encode,
        settings.security.SECRET_KEY,
        algorithm=settings.security.ALGORITHM,
    )
    
    logger.debug(f"Created access token for user {subject}, jti: {jti}")
    return encoded_jwt


def create_refresh_token(
    subject: Union[str, Any],
    expires_delta: Optional[timedelta] = None,
    device_id: Optional[str] = None,
) -> str:
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(days=settings.security.REFRESH_TOKEN_EXPIRE_DAYS)
    
    jti = secrets.token_urlsafe(32)
    
    to_encode = {
        "sub": str(subject),
        "exp": expire,
        "iat": datetime.utcnow(),
        "jti": jti,
        "type": TokenType.REFRESH.value,
    }
    
    if device_id:
        to_encode["device_id"] = device_id
    
    encoded_jwt = jwt.encode(
        to_encode,
        settings.security.SECRET_KEY,
        algorithm=settings.security.ALGORITHM,
    )
    
    logger.debug(f"Created refresh token for user {subject}, jti: {jti}")
    return encoded_jwt


def create_token_pair(
    subject: Union[str, Any],
    scopes: List[str] = None,
    device_id: Optional[str] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> TokenPair:
    access_token = create_access_token(
        subject=subject,
        scopes=scopes,
        device_id=device_id,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    
    refresh_token = create_refresh_token(
        subject=subject,
        device_id=device_id,
    )
    
    return TokenPair(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=settings.security.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        refresh_expires_in=settings.security.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        scope=" ".join(scopes or ["read", "write"]),
    )


def create_password_reset_token(subject: Union[str, Any]) -> str:
    expire = datetime.utcnow() + timedelta(hours=settings.security.PASSWORD_RESET_TOKEN_EXPIRE_HOURS)
    
    to_encode = {
        "sub": str(subject),
        "exp": expire,
        "iat": datetime.utcnow(),
        "jti": secrets.token_urlsafe(32),
        "type": TokenType.PASSWORD_RESET.value,
    }
    
    return jwt.encode(
        to_encode,
        settings.security.SECRET_KEY,
        algorithm=settings.security.ALGORITHM,
    )

def verify_password_reset_token(token: str) -> Optional[str]:
    """Verify password reset token and return user ID."""
    try:
        payload = jwt.decode(
            token,
            settings.security.SECRET_KEY,
            algorithms=[settings.security.ALGORITHM],
        )
        token_type = payload.get("type")
        if token_type != TokenType.PASSWORD_RESET.value:
            return None
        return payload.get("sub")
    except JWTError:
        return None


def verify_email_verification_token(token: str) -> Optional[Dict[str, str]]:
    """Verify email verification token and return user ID and email."""
    try:
        payload = jwt.decode(
            token,
            settings.security.SECRET_KEY,
            algorithms=[settings.security.ALGORITHM],
        )
        token_type = payload.get("type")
        if token_type != TokenType.EMAIL_VERIFICATION.value:
            return None
        return {
            "user_id": payload.get("sub"),
            "email": payload.get("email"),
        }
    except JWTError:
        return None


def create_email_verification_token(subject: Union[str, Any], email: str) -> str:
    expire = datetime.utcnow() + timedelta(hours=settings.security.EMAIL_VERIFICATION_TOKEN_EXPIRE_HOURS)
    
    to_encode = {
        "sub": str(subject),
        "exp": expire,
        "iat": datetime.utcnow(),
        "jti": secrets.token_urlsafe(32),
        "type": TokenType.EMAIL_VERIFICATION.value,
        "email": email,
    }
    
    return jwt.encode(
        to_encode,
        settings.security.SECRET_KEY,
        algorithm=settings.security.ALGORITHM,
    )


def verify_token(token: str, token_type: TokenType = TokenType.ACCESS) -> TokenData:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = jwt.decode(
            token,
            settings.security.SECRET_KEY,
            algorithms=[settings.security.ALGORITHM],
        )
        
        user_id: str = payload.get("sub")
        token_type_from_payload: str = payload.get("type")
        jti: str = payload.get("jti")
        scopes: List[str] = payload.get("scopes", [])
        
        if user_id is None:
            logger.warning("Token missing subject claim")
            raise credentials_exception
        
        if token_type_from_payload != token_type.value:
            logger.warning(f"Token type mismatch: expected {token_type.value}, got {token_type_from_payload}")
            raise credentials_exception
        
        return TokenData(
            user_id=user_id,
            token_type=TokenType(token_type_from_payload),
            scopes=scopes,
            jti=jti,
        )
        
    except ExpiredSignatureError:
        logger.warning("Token has expired")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except JWTError as e:
        logger.warning(f"JWT verification failed: {e}")
        raise credentials_exception


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception as e:
        logger.error(f"Password verification error: {e}")
        return False


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def check_password_strength(password: str) -> PasswordStrength:
    score = 0
    feedback = []
    
    if len(password) >= 8:
        score += 1
    else:
        feedback.append("Password should be at least 8 characters long")
    
    if len(password) >= 12:
        score += 1
    
    if len(password) >= 16:
        score += 1
    
    if re.search(r"[a-z]", password):
        score += 1
    else:
        feedback.append("Password should contain lowercase letters")
    
    if re.search(r"[A-Z]", password):
        score += 1
    else:
        feedback.append("Password should contain uppercase letters")
    
    if re.search(r"\d", password):
        score += 1
    else:
        feedback.append("Password should contain digits")
    
    if re.search(r"[!@#$%^&*(),.?\":{}|<>]", password):
        score += 1
    else:
        feedback.append("Password should contain special characters")
    
    if not re.search(r"(.)\1{2,}", password):
        score += 1
    else:
        feedback.append("Password should not contain repeated characters")
    
    common_passwords = ["password", "123456", "qwerty", "admin", "letmein", "welcome"]
    if password.lower() not in common_passwords:
        score += 1
    else:
        feedback.append("Password is too common")
    
    if not re.search(r"(012|123|234|345|456|567|678|789|890|abc|bcd|cde|def)", password.lower()):
        score += 1
    else:
        feedback.append("Password should not contain sequential characters")
    
    crack_times = {
        0: "instant",
        1: "seconds",
        2: "minutes",
        3: "hours",
        4: "days",
        5: "weeks",
        6: "months",
        7: "years",
        8: "decades",
        9: "centuries",
        10: "millennia",
    }
    
    return PasswordStrength(
        score=score,
        feedback=feedback,
        is_strong=score >= 7 and len(feedback) == 0,
        crack_time_display=crack_times.get(score, "unknown"),
    )


def validate_password(password: str) -> Tuple[bool, str]:
    if len(password) < settings.security.PASSWORD_MIN_LENGTH:
        return False, f"Password must be at least {settings.security.PASSWORD_MIN_LENGTH} characters long"
    
    if len(password) > settings.security.PASSWORD_MAX_LENGTH:
        return False, f"Password must be at most {settings.security.PASSWORD_MAX_LENGTH} characters long"
    
    if settings.security.PASSWORD_REQUIRE_UPPERCASE and not re.search(r"[A-Z]", password):
        return False, "Password must contain at least one uppercase letter"
    
    if settings.security.PASSWORD_REQUIRE_LOWERCASE and not re.search(r"[a-z]", password):
        return False, "Password must contain at least one lowercase letter"
    
    if settings.security.PASSWORD_REQUIRE_DIGIT and not re.search(r"\d", password):
        return False, "Password must contain at least one digit"
    
    if settings.security.PASSWORD_REQUIRE_SPECIAL and not re.search(r"[!@#$%^&*(),.?\":{}|<>]", password):
        return False, "Password must contain at least one special character"
    
    return True, ""


def generate_api_key() -> str:
    return f"ft_{secrets.token_urlsafe(32)}"


def hash_api_key(api_key: str) -> str:
    return hashlib.sha256(api_key.encode()).hexdigest()


def verify_api_key(api_key: str, hashed_key: str) -> bool:
    return hmac.compare_digest(hash_api_key(api_key), hashed_key)


def generate_verification_token() -> str:
    return secrets.token_urlsafe(32)


def generate_password_reset_token() -> str:
    return secrets.token_urlsafe(32)


def generate_session_id() -> str:
    return secrets.token_urlsafe(32)


def generate_device_id() -> str:
    return str(uuid.uuid4())


def generate_request_id() -> str:
    return str(uuid.uuid4())


class TwoFactorAuth:
    @staticmethod
    def generate_secret() -> str:
        return pyotp.random_base32()
    
    @staticmethod
    def get_totp(secret: str) -> pyotp.TOTP:
        return pyotp.TOTP(secret)
    
    @staticmethod
    def verify_code(secret: str, code: str) -> bool:
        totp = TwoFactorAuth.get_totp(secret)
        return totp.verify(code, valid_window=1)
    
    @staticmethod
    def get_provisioning_uri(secret: str, email: str) -> str:
        totp = TwoFactorAuth.get_totp(secret)
        return totp.provisioning_uri(
            name=email,
            issuer_name=settings.security.TWO_FACTOR_ISSUER,
        )
    
    @staticmethod
    def generate_qr_code(secret: str, email: str) -> bytes:
        uri = TwoFactorAuth.get_provisioning_uri(secret, email)
        qr = qrcode.QRCode(version=1, box_size=10, border=5)
        qr.add_data(uri)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        return buffer.getvalue()
    
    @staticmethod
    def generate_backup_codes(count: int = 10) -> List[str]:
        return [secrets.token_hex(4).upper() for _ in range(count)]
    
    @staticmethod
    def hash_backup_code(code: str) -> str:
        return hashlib.sha256(code.encode()).hexdigest()
    
    @staticmethod
    def verify_backup_code(code: str, hashed_codes: List[str]) -> Tuple[bool, Optional[str]]:
        hashed_input = TwoFactorAuth.hash_backup_code(code.upper().replace("-", ""))
        for hashed_code in hashed_codes:
            if hmac.compare_digest(hashed_input, hashed_code):
                return True, hashed_code
        return False, None


class RateLimiter:
    def __init__(self, redis_client=None):
        self._redis = redis_client
        self._local_store: Dict[str, List[float]] = {}
    
    async def is_rate_limited(
        self,
        key: str,
        limit: int,
        period: int,
    ) -> Tuple[bool, int, int]:
        if self._redis:
            return await self._check_redis(key, limit, period)
        return self._check_local(key, limit, period)
    
    async def _check_redis(
        self,
        key: str,
        limit: int,
        period: int,
    ) -> Tuple[bool, int, int]:
        now = time.time()
        window_start = now - period
        
        pipe = self._redis.pipeline()
        pipe.zremrangebyscore(key, 0, window_start)
        pipe.zadd(key, {str(now): now})
        pipe.zcard(key)
        pipe.expire(key, period)
        results = await pipe.execute()
        
        current_count = results[2]
        remaining = max(0, limit - current_count)
        
        return current_count > limit, remaining, int(window_start + period - now)
    
    def _check_local(
        self,
        key: str,
        limit: int,
        period: int,
    ) -> Tuple[bool, int, int]:
        now = time.time()
        window_start = now - period
        
        if key not in self._local_store:
            self._local_store[key] = []
        
        self._local_store[key] = [t for t in self._local_store[key] if t > window_start]
        self._local_store[key].append(now)
        
        current_count = len(self._local_store[key])
        remaining = max(0, limit - current_count)
        
        return current_count > limit, remaining, int(window_start + period - now)


class CSRFProtection:
    @staticmethod
    def generate_token() -> str:
        return secrets.token_urlsafe(32)
    
    @staticmethod
    def verify_token(token: str, expected: str) -> bool:
        return hmac.compare_digest(token, expected)
    
    @staticmethod
    def get_token_from_request(request: Request) -> Optional[str]:
        token = request.headers.get(settings.security.CSRF_HEADER_NAME)
        if not token:
            token = request.cookies.get(settings.security.CSRF_COOKIE_NAME)
        return token


class IPValidator:
    PRIVATE_RANGES = [
        ("10.0.0.0", "10.255.255.255"),
        ("172.16.0.0", "172.31.255.255"),
        ("192.168.0.0", "192.168.255.255"),
        ("127.0.0.0", "127.255.255.255"),
    ]
    
    @staticmethod
    def is_valid_ip(ip: str) -> bool:
        try:
            parts = ip.split(".")
            if len(parts) != 4:
                return False
            for part in parts:
                num = int(part)
                if num < 0 or num > 255:
                    return False
            return True
        except (ValueError, AttributeError):
            return False
    
    @staticmethod
    def is_private_ip(ip: str) -> bool:
        if not IPValidator.is_valid_ip(ip):
            return False
        
        def ip_to_int(ip_str: str) -> int:
            parts = ip_str.split(".")
            return (int(parts[0]) << 24) + (int(parts[1]) << 16) + (int(parts[2]) << 8) + int(parts[3])
        
        ip_int = ip_to_int(ip)
        
        for start, end in IPValidator.PRIVATE_RANGES:
            if ip_to_int(start) <= ip_int <= ip_to_int(end):
                return True
        
        return False
    
    @staticmethod
    def get_client_ip(request: Request) -> str:
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip
        
        if request.client:
            return request.client.host
        
        return "unknown"


class SecurityAuditLogger:
    def __init__(self):
        self._logger = logging.getLogger("security_audit")
    
    def log_login_attempt(
        self,
        user_id: Optional[str],
        email: str,
        success: bool,
        ip_address: str,
        user_agent: str,
        reason: Optional[str] = None,
    ):
        self._logger.info(
            f"LOGIN_ATTEMPT | user_id={user_id} | email={email} | success={success} | "
            f"ip={ip_address} | user_agent={user_agent[:50]} | reason={reason}"
        )
    
    def log_logout(
        self,
        user_id: str,
        ip_address: str,
        session_id: Optional[str] = None,
    ):
        self._logger.info(
            f"LOGOUT | user_id={user_id} | ip={ip_address} | session_id={session_id}"
        )
    
    def log_password_change(
        self,
        user_id: str,
        ip_address: str,
        method: str,
    ):
        self._logger.info(
            f"PASSWORD_CHANGE | user_id={user_id} | ip={ip_address} | method={method}"
        )
    
    def log_2fa_event(
        self,
        user_id: str,
        event: str,
        success: bool,
        ip_address: str,
    ):
        self._logger.info(
            f"2FA_EVENT | user_id={user_id} | event={event} | success={success} | ip={ip_address}"
        )
    
    def log_api_key_event(
        self,
        user_id: str,
        event: str,
        key_id: str,
        ip_address: str,
    ):
        self._logger.info(
            f"API_KEY_EVENT | user_id={user_id} | event={event} | key_id={key_id} | ip={ip_address}"
        )
    
    def log_suspicious_activity(
        self,
        user_id: Optional[str],
        activity: str,
        details: Dict[str, Any],
        ip_address: str,
    ):
        self._logger.warning(
            f"SUSPICIOUS_ACTIVITY | user_id={user_id} | activity={activity} | "
            f"details={details} | ip={ip_address}"
        )
    
    def log_access_denied(
        self,
        user_id: Optional[str],
        resource: str,
        reason: str,
        ip_address: str,
    ):
        self._logger.warning(
            f"ACCESS_DENIED | user_id={user_id} | resource={resource} | "
            f"reason={reason} | ip={ip_address}"
        )


security_audit_logger = SecurityAuditLogger()


def require_scopes(*required_scopes: str):
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            token_data = kwargs.get("token_data")
            if not token_data:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authentication required",
                )
            
            for scope in required_scopes:
                if scope not in token_data.scopes:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=f"Missing required scope: {scope}",
                    )
            
            return await func(*args, **kwargs)
        return wrapper
    return decorator


def sanitize_input(text: str, max_length: int = 10000) -> str:
    if not text:
        return ""
    
    text = text[:max_length]
    text = re.sub(r'<script[^>]*>.*?</script>', '', text, flags=re.IGNORECASE | re.DOTALL)
    text = re.sub(r'<[^>]+>', '', text)
    text = text.replace("'", "''")
    
    return text.strip()


def mask_sensitive_data(data: str, visible_chars: int = 4) -> str:
    if not data:
        return ""
    
    if len(data) <= visible_chars * 2:
        return "*" * len(data)
    
    return data[:visible_chars] + "*" * (len(data) - visible_chars * 2) + data[-visible_chars:]


def mask_email(email: str) -> str:
    if not email or "@" not in email:
        return email
    
    local, domain = email.split("@", 1)
    if len(local) <= 2:
        masked_local = "*" * len(local)
    else:
        masked_local = local[0] + "*" * (len(local) - 2) + local[-1]
    
    return f"{masked_local}@{domain}"


def generate_secure_filename(original_filename: str) -> str:
    import os
    _, ext = os.path.splitext(original_filename)
    safe_ext = re.sub(r'[^a-zA-Z0-9.]', '', ext)[:10]
    return f"{secrets.token_urlsafe(16)}{safe_ext}"


class ContentSecurityPolicy:
    def __init__(self):
        self.directives = {
            "default-src": ["'self'"],
            "script-src": ["'self'", "'unsafe-inline'"],
            "style-src": ["'self'", "'unsafe-inline'"],
            "img-src": ["'self'", "data:", "https:"],
            "font-src": ["'self'"],
            "connect-src": ["'self'"],
            "frame-ancestors": ["'none'"],
            "base-uri": ["'self'"],
            "form-action": ["'self'"],
        }
    
    def add_directive(self, directive: str, values: List[str]):
        if directive in self.directives:
            self.directives[directive].extend(values)
        else:
            self.directives[directive] = values
    
    def to_header(self) -> str:
        return "; ".join(
            f"{directive} {' '.join(values)}"
            for directive, values in self.directives.items()
        )


csp = ContentSecurityPolicy()
