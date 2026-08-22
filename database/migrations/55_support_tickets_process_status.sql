-- Migration 55: Add process_status column to support_tickets table

ALTER TABLE support_tickets
ADD COLUMN IF NOT EXISTS process_status VARCHAR(255) NULL AFTER status;
