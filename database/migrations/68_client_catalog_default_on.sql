-- Soft-enable client viewer catalog by default for delivery workspace UX.
ALTER TABLE clients
  MODIFY COLUMN viewer_catalog_enabled TINYINT(1) NOT NULL DEFAULT 1;

UPDATE clients
   SET viewer_catalog_enabled = 1
 WHERE status = 'active'
   AND COALESCE(viewer_catalog_enabled, 0) = 0;
