-- AI-007 keeps the materialized relationship projection aligned when a DAY
-- deletion removes one encounter source. Node receipts intentionally remain:
-- ordinary DAY deletion must not replay a node already published in this cycle.

CREATE OR REPLACE FUNCTION "daily_energy"."refresh_ai007_relationship_projection_after_link_delete"()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = "daily_energy", pg_catalog
AS $$
DECLARE
  next_fingerprint bytea;
BEGIN
  SELECT sha256(convert_to(
    'relationship-projection-v1|' || COALESCE(string_agg(
      link."productDate"::text || ':' || link."sourceLightId"::text || ':' ||
        link."sourceValidityRevision"::text,
      '|' ORDER BY link."productDate",link."sourceLightId"
    ),''),
    'UTF8'
  ))
  INTO next_fingerprint
  FROM "daily_energy"."app_relationship_encounter_link" link
  JOIN "daily_energy"."app_daily_light_fact" light
    ON light.id=link."sourceLightId"
   AND light."sourceValidityRevision"=link."sourceValidityRevision"
  WHERE link."cycleId"=OLD."cycleId";

  UPDATE "daily_energy"."app_relationship_cycle"
     SET revision=revision+1,"projectionFingerprint"=next_fingerprint
   WHERE id=OLD."cycleId" AND state='ACTIVE' AND "activeSlot" IS TRUE;
  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION "daily_energy"."refresh_ai007_relationship_projection_after_link_delete"()
  FROM PUBLIC;

DROP TRIGGER IF EXISTS "app_relationship_link_ai007_projection_delete_trg"
  ON "daily_energy"."app_relationship_encounter_link";
CREATE TRIGGER "app_relationship_link_ai007_projection_delete_trg"
AFTER DELETE ON "daily_energy"."app_relationship_encounter_link"
FOR EACH ROW
EXECUTE FUNCTION "daily_energy"."refresh_ai007_relationship_projection_after_link_delete"();

-- S-06 fixes ordinary DAY deletion to no-replay. A new source fingerprint in
-- the same cycle therefore cannot create a second receipt for the same node.
CREATE UNIQUE INDEX "app_relationship_node_receipt_cycle_node_key"
  ON "daily_energy"."app_relationship_node_receipt"("cycleId","nodeCode");

-- Repair any active projection left stale by a DAY deletion before this
-- trigger existed. A changed materialized projection advances the cycle CAS.
WITH projection AS (
  SELECT cycle.id,
    sha256(convert_to(
      'relationship-projection-v1|' || COALESCE(string_agg(
        source."productDate"::text || ':' || source."sourceLightId"::text || ':' ||
          source."sourceValidityRevision"::text,
        '|' ORDER BY source."productDate",source."sourceLightId"
      ),''),
      'UTF8'
    )) AS fingerprint
  FROM "daily_energy"."app_relationship_cycle" cycle
  LEFT JOIN LATERAL (
    SELECT link."productDate",link."sourceLightId",link."sourceValidityRevision"
    FROM "daily_energy"."app_relationship_encounter_link" link
    JOIN "daily_energy"."app_daily_light_fact" light
      ON light.id=link."sourceLightId"
     AND light."sourceValidityRevision"=link."sourceValidityRevision"
    WHERE link."cycleId"=cycle.id
  ) source ON TRUE
  WHERE cycle.state='ACTIVE' AND cycle."activeSlot" IS TRUE
  GROUP BY cycle.id
)
UPDATE "daily_energy"."app_relationship_cycle" cycle
   SET revision=cycle.revision+1,"projectionFingerprint"=projection.fingerprint
  FROM projection
 WHERE cycle.id=projection.id
   AND cycle."projectionFingerprint" IS DISTINCT FROM projection.fingerprint;
