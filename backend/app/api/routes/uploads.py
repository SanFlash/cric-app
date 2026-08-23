"""
Image upload (section 30: "Secure file upload validation, image type
validation"). Validates content-type against an allowlist and enforces a
max size BEFORE writing anything to disk, then writes under a random
filename (never the client-supplied name) to avoid path traversal and
filename collisions. Returns a URL the caller stores on Team.logo_url or
Player.profile_image_url.
"""
import os
import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File

from app.core.config import settings
from app.api.deps import get_current_user
from app.models.org import User

router = APIRouter(prefix="/uploads", tags=["uploads"])

EXT_BY_MIME = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}


@router.post("/image")
async def upload_image(file: UploadFile = File(...), user: User = Depends(get_current_user)):
    if file.content_type not in settings.ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported image type '{file.content_type}'. Allowed: {settings.ALLOWED_IMAGE_TYPES}",
        )

    max_bytes = settings.MAX_UPLOAD_MB * 1024 * 1024
    contents = await file.read()
    if len(contents) > max_bytes:
        raise HTTPException(status_code=400, detail=f"Image exceeds {settings.MAX_UPLOAD_MB}MB limit")
    if len(contents) == 0:
        raise HTTPException(status_code=400, detail="Empty file")

    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    ext = EXT_BY_MIME[file.content_type]
    filename = f"{uuid.uuid4().hex}{ext}"  # never trust the client-supplied filename
    path = os.path.join(settings.UPLOAD_DIR, filename)
    with open(path, "wb") as f:
        f.write(contents)

    return {"url": f"/uploads/{filename}", "content_type": file.content_type, "size_bytes": len(contents)}
