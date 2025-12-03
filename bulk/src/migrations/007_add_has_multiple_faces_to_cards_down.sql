-- Rollback: Remove has_multiple_faces flag from cards table
ALTER TABLE cards DROP COLUMN has_multiple_faces
