-- Fix notification_settings NULL team_id constraint violations
-- Addresses issue where Discord OAuth users with team invitations would fail during session deserialization
--
-- GitHub Issue: NULL team_id in notification_settings causes 500 errors in invite flow
-- Root Cause: deserialize_user() attempts to insert notification_settings with NULL team_id
--             when Discord users accept team invitations (no active_team set yet)

-- ================================================================================
-- 1. Fix deserialize_user() function - prevent NULL team_id inserts
-- ================================================================================

CREATE OR REPLACE FUNCTION deserialize_user(_id uuid) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _result JSON;
BEGIN
    WITH notification_data AS (
        SELECT u.id,
               u.name,
               u.email,
               u.avatar_url,
               u.active_team,
               u.active_project,
               u.socket_id,
               u.timezone,
               u.default_view,
               u.setup_completed,
               u.build_v,
               u.last_project,
               u.organization_id,
               u.license_type_id,
               u.notifications_popup_timeout,
               COALESCE(SUM(ptn.count), 0)::INT AS pending_tasks_count,
               COALESCE(ns.email_notifications_enabled, TRUE)         AS email_notifications_enabled,
               COALESCE(ns.show_unread_items_count, TRUE)             AS show_unread_items_count,
               COALESCE(ns.popup_notifications_enabled, TRUE)         AS popup_notifications_enabled,
               COALESCE(ns.daily_digest_enabled, FALSE)               AS daily_digest_enabled
        FROM users u
                 LEFT JOIN notification_settings ns ON (u.id = ns.user_id AND u.active_team = ns.team_id)
                 LEFT JOIN pending_task_notifications ptn ON u.id = ptn.user_id
        WHERE u.id = _id
        GROUP BY u.id, ns.email_notifications_enabled, ns.show_unread_items_count, ns.popup_notifications_enabled,
                 ns.daily_digest_enabled
    ),
    alerts_data AS (
        SELECT COALESCE(COUNT(team_member_id), 0) AS popup_notifications_count
        FROM notifications
        WHERE team_member_id IN (SELECT tm.id FROM team_members tm WHERE tm.user_id = _id)
          AND viewed IS FALSE
    ),
    complete_user_data AS (
        SELECT nd.id,
               nd.name,
               nd.email,
               nd.avatar_url,
               nd.active_team,
               nd.active_project,
               nd.socket_id,
               nd.timezone,
               tz.name                                                  AS timezone_name,
               nd.default_view,
               nd.setup_completed,
               nd.build_v,
               nd.last_project,
               nd.organization_id,
               nd.license_type_id,
               slt.color_code,
               slt.total_projects,
               slt.total_teams,
               slt.total_members,
               nd.notifications_popup_timeout,
               nd.pending_tasks_count,
               nd.email_notifications_enabled,
               nd.show_unread_items_count,
               nd.popup_notifications_enabled,
               nd.daily_digest_enabled,
               ad.popup_notifications_count,
               CASE WHEN (tm.role_id IS NOT NULL) THEN TRUE ELSE FALSE END AS is_member
        FROM notification_data nd
        CROSS JOIN alerts_data ad
        LEFT JOIN timezones tz ON tz.id = nd.timezone
        LEFT JOIN sys_license_types slt ON slt.id = nd.license_type_id
        LEFT JOIN team_members tm ON (tm.user_id = nd.id AND tm.team_id = nd.team_id AND tm.active IS TRUE)
    )
    SELECT ROW_TO_JSON(complete_user_data.*) INTO _result FROM complete_user_data;

    -- Ensure notification settings exist using INSERT...ON CONFLICT for better concurrency
    -- ✅ FIXED: Only insert if team_id is not NULL to prevent constraint violations
    INSERT INTO notification_settings (user_id, team_id, email_notifications_enabled, popup_notifications_enabled, show_unread_items_count)
    SELECT _id, _team_id, TRUE, TRUE, TRUE
    FROM (
        SELECT COALESCE(
            (SELECT active_team FROM users WHERE id = _id),
            (SELECT id FROM teams WHERE user_id = _id LIMIT 1)
        ) AS _team_id
    ) AS team_data
    WHERE _team_id IS NOT NULL
    ON CONFLICT (user_id, team_id) DO NOTHING;

    RETURN _result;
END
$$;

-- ================================================================================
-- 2. Fix register_discord_user() function - set active_team on invite
-- ================================================================================

CREATE OR REPLACE FUNCTION register_discord_user(_body json)
RETURNS json AS $$
DECLARE
  _user_id UUID;
  _user_email TEXT;
  _discord_id TEXT;
  _existing_user RECORD;
  _organization_id UUID;
  _team_id UUID;
  _team_name TEXT;
  _default_timezone UUID;
  _role_id UUID;
BEGIN
  _discord_id := TRIM(_body->>'id');
  _user_email := LOWER(TRIM(_body->>'email'));

  -- Get default timezone (UTC)
  SELECT id INTO _default_timezone FROM timezones WHERE name = 'UTC' LIMIT 1;

  -- Check for existing Discord user (not deleted)
  SELECT * INTO _existing_user FROM users
  WHERE discord_id = _discord_id AND is_deleted = FALSE;

  IF _existing_user.id IS NOT NULL THEN
    -- Update existing user with latest Discord data
    UPDATE users SET
      discord_username = TRIM(_body->>'displayName'),
      discord_avatar = TRIM(_body->>'avatar'),
      discord_guilds = COALESCE((_body->>'guilds')::jsonb, '[]'::jsonb),
      updated_at = NOW()
    WHERE id = _existing_user.id;

    RETURN json_build_object(
      'id', _existing_user.id,
      'email', _existing_user.email,
      'name', _existing_user.name,
      'discord_id', _discord_id
    );
  END IF;

  -- Check for email conflict with local/Google accounts (prevents OAuth conflicts)
  SELECT * INTO _existing_user FROM users
  WHERE email = _user_email AND is_deleted = FALSE;

  IF _existing_user.id IS NOT NULL THEN
    RAISE EXCEPTION 'EMAIL_EXISTS' USING HINT = _user_email;
  END IF;

  -- Create new user with Discord OAuth
  INSERT INTO users (
    email,
    name,
    discord_id,
    discord_username,
    discord_avatar,
    discord_guilds,
    timezone_id,
    setup_completed
  ) VALUES (
    _user_email,
    TRIM(_body->>'displayName'),
    _discord_id,
    TRIM(_body->>'displayName'),
    TRIM(_body->>'avatar'),
    COALESCE((_body->>'guilds')::jsonb, '[]'::jsonb),
    _default_timezone,
    FALSE
  ) RETURNING id INTO _user_id;

  -- ✅ FIXED: Handle team invitation with active_team update
  IF _body->>'teamMember' IS NOT NULL AND _body->>'teamMember' != '' THEN
    -- Update existing team member invitation with new user and get the team_id
    UPDATE team_members SET
      user_id = _user_id
    WHERE id = (_body->>'teamMember')::UUID
    RETURNING team_id INTO _team_id;

    -- Set active team for invited user to prevent NULL team_id issues
    IF _team_id IS NOT NULL THEN
      UPDATE users SET active_team = _team_id WHERE id = _user_id;
    END IF;

    RETURN json_build_object(
      'id', _user_id,
      'email', _user_email,
      'name', _body->>'displayName',
      'discord_id', _discord_id,
      'active_team', _team_id
    );
  END IF;

  -- Create default organization
  _team_name := CONCAT(TRIM(_body->>'displayName'), '''s Team');

  INSERT INTO organizations (organization_name, user_id, trial_in_progress,
                             trial_expire_date, subscription_status, license_type_id)
  VALUES (_team_name, _user_id, TRUE, CURRENT_DATE + INTERVAL '9999 days',
          'active', (SELECT id FROM sys_license_types WHERE key = 'SELF_HOSTED'))
  RETURNING id INTO _organization_id;

  -- Create default team
  INSERT INTO teams (name, user_id, organization_id)
  VALUES (_team_name, _user_id, _organization_id)
  RETURNING id INTO _team_id;

  -- Set active team for user
  UPDATE users SET active_team = _team_id WHERE id = _user_id;

  -- Create default roles for team
  INSERT INTO roles (name, team_id, default_role) VALUES ('Member', _team_id, TRUE);
  INSERT INTO roles (name, team_id, admin_role) VALUES ('Admin', _team_id, TRUE);
  INSERT INTO roles (name, team_id, owner) VALUES ('Owner', _team_id, TRUE) RETURNING id INTO _role_id;

  -- Add user as team owner
  INSERT INTO team_members (user_id, team_id, role_id)
  VALUES (_user_id, _team_id, _role_id);

  RETURN json_build_object(
    'id', _user_id,
    'email', _user_email,
    'name', TRIM(_body->>'displayName'),
    'discord_id', _discord_id,
    'active_team', _team_id,
    'organization_id', _organization_id
  );
END
$$ LANGUAGE plpgsql;

-- ================================================================================
-- 3. Fix trigger - fire on team_members UPDATE as well
-- ================================================================================

-- Drop existing trigger
DROP TRIGGER IF EXISTS insert_notification_settings ON team_members;

-- Recreate trigger to also fire on user_id UPDATE
CREATE TRIGGER insert_notification_settings
    AFTER INSERT OR UPDATE OF user_id
    ON team_members
    FOR EACH ROW
    WHEN (NEW.user_id IS NOT NULL)
EXECUTE FUNCTION notification_settings_insert_trigger_fn();

-- ================================================================================
-- Summary
-- ================================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '✅ Migration 20251108000000 applied successfully:';
    RAISE NOTICE '   1. deserialize_user() - now prevents NULL team_id inserts';
    RAISE NOTICE '   2. register_discord_user() - sets active_team for invited users';
    RAISE NOTICE '   3. Trigger - fires on team_members UPDATE as well as INSERT';
    RAISE NOTICE '';
    RAISE NOTICE 'This fixes the "null value in column team_id violates not-null constraint" error';
    RAISE NOTICE 'for Discord OAuth users accepting team invitations.';
    RAISE NOTICE '';
END $$;
