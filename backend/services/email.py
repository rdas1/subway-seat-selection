import os
import resend
from typing import Optional

# Initialize Resend API key
resend_api_key = os.getenv("RESEND_API_KEY")
if not resend_api_key:
    raise ValueError("RESEND_API_KEY environment variable is not set")

resend.api_key = resend_api_key

# Get frontend URL from environment
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")


async def send_verification_email(
    email: str,
    verification_type: str,
    token: Optional[str] = None,
    code: Optional[str] = None
) -> None:
    """
    Send verification email with magic link and/or verification code.
    
    Args:
        email: Recipient email address
        verification_type: "magic_link", "token", or "both"
        token: Verification token for magic link (if applicable)
        code: 6-digit verification code (if applicable)
    """
    subject = "Sign in to Subway Seat Selection"
    
    # Build email body
    body_parts = []
    body_parts.append("Welcome! Use one of the methods below to sign in:")
    body_parts.append("")
    
    if verification_type in ("magic_link", "both") and token:
        magic_link = f"{FRONTEND_URL}/verify?token={token}"
        body_parts.append("🔗 Magic Link:")
        body_parts.append(f"Click here to sign in: {magic_link}")
        body_parts.append("")
    
    if verification_type in ("token", "both") and code:
        body_parts.append("🔢 Verification Code:")
        body_parts.append(f"Enter this code: {code}")
        body_parts.append("")
    
    body_parts.append("This link/code will expire in 30 minutes.")
    body_parts.append("")
    body_parts.append("If you didn't request this, you can safely ignore this email.")
    
    email_body = "\n".join(body_parts)
    
    # Send email via Resend
    try:
        # Resend API is synchronous, but we're in an async function
        # We'll run it in a thread pool to avoid blocking
        import asyncio
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None,
            lambda: resend.Emails.send({
                "from": "Subway Simulator <no-reply@rajrishidas.com>",  
                "to": [email],
                "subject": subject,
                "text": email_body,
            })
        )
    except Exception as e:
        # Log error but don't expose internal details
        print(f"Failed to send email to {email}: {str(e)}")
        raise Exception("Failed to send verification email")

