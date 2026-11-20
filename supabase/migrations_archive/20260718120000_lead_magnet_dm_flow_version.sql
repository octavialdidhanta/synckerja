-- Opening-first DM flow (ManyChat-style): v2 enrollments send Opening DM before follow gate.
ALTER TABLE lead_magnet_enrollments
  ADD COLUMN IF NOT EXISTS dm_flow_version smallint NOT NULL DEFAULT 1;

COMMENT ON COLUMN lead_magnet_enrollments.dm_flow_version IS
  '1 = legacy (follow gate then material offer), 2 = opening-first (material offer then follow gate)';
