-- Add photos.uploader_id so bind / delete operations can verify
-- the requesting user actually owns the photo (P0-3, P1-9).
ALTER TABLE photos ADD COLUMN uploader_id UUID;
ALTER TABLE photos ADD CONSTRAINT photos_uploader_id_fkey
  FOREIGN KEY (uploader_id) REFERENCES users(id) ON DELETE NO ACTION ON UPDATE NO ACTION;
CREATE INDEX "ix_photos_uploader" ON photos (uploader_id);
