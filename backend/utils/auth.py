import os
import secrets
from datetime import datetime, timedelta
from typing import Optional, Dict
from jose import JWTError, jwt

# JWT configuration
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
if not JWT_SECRET_KEY:
    raise ValueError("JWT_SECRET_KEY environment variable is not set")

JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = 30


def create_access_token(user_id: int, email: str) -> str:
    """
    Create a JWT access token for the user.
    
    Args:
        user_id: User ID
        email: User email
    
    Returns:
        Encoded JWT token string
    """
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode = {
        "sub": str(user_id),  # Subject (user ID)
        "email": email,
        "exp": expire,
        "iat": datetime.utcnow(),  # Issued at
    }
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
    return encoded_jwt


def verify_token(token: str) -> Optional[Dict]:
    """
    Verify and decode a JWT token.
    
    Args:
        token: JWT token string
    
    Returns:
        Decoded token payload if valid, None otherwise
    """
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        return payload
    except JWTError:
        return None


def generate_verification_token() -> str:
    """
    Generate a secure random token for magic link verification.
    
    Returns:
        URL-safe random token string
    """
    return secrets.token_urlsafe(32)


def generate_verification_code() -> str:
    """
    Generate a 6-digit verification code.
    
    Returns:
        6-digit code as string
    """
    return f"{secrets.randbelow(1000000):06d}"

