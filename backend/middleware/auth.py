from fastapi import Depends, HTTPException, status, Cookie
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
from database import get_db
from models import User
from utils.auth import verify_token


async def get_current_user(
    session_token: Optional[str] = Cookie(None, alias="session_token"),
    db: AsyncSession = Depends(get_db)
) -> User:
    """
    Dependency to get the current authenticated user from session cookie.
    
    Args:
        session_token: JWT token from session cookie
        db: Database session
    
    Returns:
        User object if authenticated
    
    Raises:
        HTTPException: If token is missing or invalid
    """
    if not session_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Verify JWT token
    payload = verify_token(session_token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Get user ID from token
    user_id = int(payload.get("sub"))
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Fetch user from database
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return user


async def get_optional_user(
    session_token: Optional[str] = Cookie(None, alias="session_token"),
    db: AsyncSession = Depends(get_db)
) -> Optional[User]:
    """
    Optional dependency to get the current user if authenticated, None otherwise.
    Useful for endpoints that work both with and without authentication.
    """
    if not session_token:
        return None
    
    try:
        return await get_current_user(session_token, db)
    except HTTPException:
        return None

