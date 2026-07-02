from pydantic import BaseModel
from typing import Optional
from uuid import UUID


class PhotoUploadResponse(BaseModel):
    temp_token: str
    original_url: str
    thumbnail_url: str
    width: int
    height: int
    file_size: int


class PhotoBindRequest(BaseModel):
    temp_token: str
