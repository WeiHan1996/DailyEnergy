SET search_path TO "daily_energy", pg_catalog;

-- OpenAPI has always exposed CANCELLED for the one guard-free cancellable
-- export stage. PostgreSQL requires a newly added enum value to commit before
-- a later migration may reference it in constraints or function bodies.
ALTER TYPE "daily_energy"."DataTaskState" ADD VALUE IF NOT EXISTS 'CANCELLED';

-- Rollback requires proving no task uses CANCELLED and rebuilding the enum.
