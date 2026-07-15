-- Add manual_override column to products table to protect manual toggles from auto sync
ALTER TABLE products ADD COLUMN IF NOT EXISTS manual_override BOOLEAN DEFAULT false;
