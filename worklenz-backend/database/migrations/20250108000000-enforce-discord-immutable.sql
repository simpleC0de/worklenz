-- Migration: Enforce Discord ID immutability and validation
-- Date: 2025-01-08
-- Purpose: Prevent discord_id from being changed after registration

BEGIN;

-- Create trigger function to prevent discord_id updates
CREATE OR REPLACE FUNCTION prevent_discord_id_update()
RETURNS TRIGGER AS $$
BEGIN
    -- Allow setting discord_id from NULL to a value (for existing users)
    IF OLD.discord_id IS NULL AND NEW.discord_id IS NOT NULL THEN
        RETURN NEW;
    END IF;

    -- Prevent any change to discord_id once it's set
    IF OLD.discord_id IS NOT NULL AND OLD.discord_id != NEW.discord_id THEN
        RAISE EXCEPTION 'Discord ID cannot be changed once set';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to enforce immutability
DROP TRIGGER IF EXISTS trigger_prevent_discord_id_update ON users;
CREATE TRIGGER trigger_prevent_discord_id_update
    BEFORE UPDATE ON users
    FOR EACH ROW
    WHEN (OLD.discord_id IS DISTINCT FROM NEW.discord_id)
    EXECUTE FUNCTION prevent_discord_id_update();

-- Add comment for documentation
COMMENT ON TRIGGER trigger_prevent_discord_id_update ON users IS
'Prevents discord_id from being changed after initial registration. Allows setting from NULL to a value for existing users.';

COMMIT;
