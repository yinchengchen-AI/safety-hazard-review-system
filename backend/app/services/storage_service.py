import io
import uuid
from minio import Minio
from PIL import Image
from app.core.config import settings


class StorageService:
    def __init__(self):
        self.client = Minio(
            settings.MINIO_ENDPOINT,
            access_key=settings.MINIO_ACCESS_KEY,
            secret_key=settings.MINIO_SECRET_KEY,
            secure=settings.MINIO_SECURE,
        )
        self.bucket = settings.MINIO_BUCKET
        self._ensure_bucket()

    def _ensure_bucket(self):
        if not self.client.bucket_exists(self.bucket):
            self.client.make_bucket(self.bucket)

    async def upload_image(self, content: bytes, filename: str, temp_token: str):
        ext = "jpg" if filename.lower().endswith((".jpg", ".jpeg")) else "png"
        object_name = f"temp/{temp_token}/{uuid.uuid4()}.{ext}"
        thumb_name = f"temp/{temp_token}/{uuid.uuid4()}_thumb.{ext}"

        # Generate thumbnail
        img = Image.open(io.BytesIO(content))
        img.thumbnail((400, 400))
        thumb_buffer = io.BytesIO()
        img_format = "JPEG" if ext == "jpg" else "PNG"
        if img.mode in ("RGBA", "P") and img_format == "JPEG":
            img = img.convert("RGB")
        img.save(thumb_buffer, format=img_format)
        thumb_buffer.seek(0)

        # Upload original
        self.client.put_object(
            self.bucket,
            object_name,
            io.BytesIO(content),
            length=len(content),
            content_type=f"image/{ext}" if ext != "jpg" else "image/jpeg",
        )

        # Upload thumbnail
        self.client.put_object(
            self.bucket,
            thumb_name,
            thumb_buffer,
            length=thumb_buffer.getbuffer().nbytes,
            content_type=f"image/{ext}" if ext != "jpg" else "image/jpeg",
        )

        # Build URLs (presigned or direct)
        original_url = f"/{self.bucket}/{object_name}"
        thumbnail_url = f"/{self.bucket}/{thumb_name}"

        return original_url, thumbnail_url

    def upload_file(self, content: bytes, object_name: str, content_type: str = "application/octet-stream") -> str:
        self.client.put_object(
            self.bucket,
            object_name,
            io.BytesIO(content),
            length=len(content),
            content_type=content_type,
        )
        return f"/{self.bucket}/{object_name}"

    def get_file(self, object_name: str):
        # object_name should not include bucket prefix
        if object_name.startswith(f"/{self.bucket}/"):
            object_name = object_name[len(f"/{self.bucket}/"):]
        return self.client.get_object(self.bucket, object_name)

    def delete_file(self, path: str) -> None:
        object_name = path.lstrip("/")
        if object_name.startswith(f"{self.bucket}/"):
            object_name = object_name[len(f"{self.bucket}/"):]
        try:
            self.client.remove_object(self.bucket, object_name)
        except Exception:
            pass

