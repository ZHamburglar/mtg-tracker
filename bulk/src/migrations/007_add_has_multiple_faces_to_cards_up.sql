-- Migration: Add has_multiple_faces flag to cards table
-- This flag indicates whether a card has multiple faces (transform, modal DFC, split cards, etc.)

ALTER TABLE cards ADD COLUMN has_multiple_faces BOOLEAN DEFAULT FALSE AFTER layout
