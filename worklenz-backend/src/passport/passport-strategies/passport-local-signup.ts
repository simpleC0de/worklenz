import bcrypt from "bcrypt";
import {Strategy as LocalStrategy} from "passport-local";

import {DEFAULT_ERROR_MESSAGE} from "../../shared/constants";
import {sendWelcomeEmail} from "../../shared/email-templates";
import {log_error} from "../../shared/utils";
import {discordBot} from "../../shared/discord/discord-bot-service";

import db from "../../config/db";
import {Request} from "express";
import {ERROR_KEY, SUCCESS_KEY} from "./passport-constants";

async function isGoogleAccountFound(email: string) {
  const q = `
    SELECT 1
    FROM users
    WHERE LOWER(email) = $1
      AND google_id IS NOT NULL;
  `;
  const result = await db.query(q, [email.toLowerCase().trim()]);
  return !!result.rowCount;
}

async function isAccountDeactivated(email: string) {
  const q = `
    SELECT 1
    FROM users
    WHERE LOWER(email) = $1
      AND is_deleted = TRUE;
  `;
  const result = await db.query(q, [email.toLowerCase().trim()]);
  return !!result.rowCount;
}

/**
 * Validate Discord ID format (17-19 digits)
 * @param discordId Discord user ID to validate
 * @returns true if format is valid
 */
function isValidDiscordIdFormat(discordId: string): boolean {
  return /^\d{17,19}$/.test(discordId);
}

/**
 * Check if Discord ID is already in use
 * @param discordId Discord user ID to check
 * @returns true if Discord ID already exists
 */
async function isDiscordIdTaken(discordId: string): Promise<boolean> {
  const q = `
    SELECT 1
    FROM users
    WHERE discord_id = $1;
  `;
  const result = await db.query(q, [discordId]);
  return !!result.rowCount;
}

/**
 * Validate Discord ID against guild membership
 * @param discordId Discord user ID
 * @param guildId Discord guild ID
 * @returns true if user is in the guild
 */
async function isDiscordUserInGuild(discordId: string, guildId: string): Promise<boolean> {
  try {
    return await discordBot.isUserInGuild(discordId, guildId);
  } catch (error) {
    log_error(error);
    return false;
  }
}

async function registerUser(password: string, team_id: string, name: string, team_name: string, email: string, timezone: string, team_member_id: string, discord_id: string) {
  const salt = bcrypt.genSaltSync(10);
  const encryptedPassword = bcrypt.hashSync(password, salt);

  const teamId = team_id || null;
  const q = "SELECT register_user($1) AS user;";

  const body = {
    name,
    team_name,
    email: email.toLowerCase().trim(),
    password: encryptedPassword,
    timezone,
    invited_team_id: teamId,
    team_member_id,
    discord_id,
  };

  const result = await db.query(q, [JSON.stringify(body)]);
  const [data] = result.rows;
  return data.user;
}

async function handleSignUp(req: Request, email: string, password: string, done: any) {
  (req.session as any).flash = {};
  // team = Invited team_id if req.body.from_invitation is true
  const {name, team_name, team_member_id, team_id, timezone, discord_id} = req.body;

  if (!team_name) return done(null, null, req.flash(ERROR_KEY, "Team name is required"));

  // ENFORCE: Block self-registration (only invite-based registration allowed)
  if (!team_member_id) {
    return done(null, null, req.flash(ERROR_KEY, "Registration is invite-only. Please request an invite from your team."));
  }

  // ENFORCE: Discord ID is required
  if (!discord_id) {
    return done(null, null, req.flash(ERROR_KEY, "Discord ID is required. Please provide your Discord User ID."));
  }

  // Validate Discord ID format
  if (!isValidDiscordIdFormat(discord_id)) {
    return done(null, null, req.flash(ERROR_KEY, "Invalid Discord ID format. Discord IDs must be 17-19 digits."));
  }

  // Check if Discord ID is already in use
  const discordIdTaken = await isDiscordIdTaken(discord_id);
  if (discordIdTaken) {
    return done(null, null, req.flash(ERROR_KEY, "This Discord ID is already registered. Please use your own Discord ID."));
  }

  // Validate Discord guild membership
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!guildId) {
    log_error(new Error("DISCORD_GUILD_ID not configured"));
    return done(null, null, req.flash(ERROR_KEY, DEFAULT_ERROR_MESSAGE));
  }

  const inGuild = await isDiscordUserInGuild(discord_id, guildId);
  if (!inGuild) {
    return done(null, null, req.flash(ERROR_KEY, "You must be a member of the ESX Discord server to register. Please join the server and try again."));
  }

  const googleAccountFound = await isGoogleAccountFound(email);
  if (googleAccountFound)
    return done(null, null, req.flash(ERROR_KEY, `${req.body.email} is already linked with a Google account.`));

  const accountDeactivated = await isAccountDeactivated(email);
  if (accountDeactivated)
    return done(null, null, req.flash(ERROR_KEY, `Account for email ${email} has been deactivated. Please contact support to reactivate your account.`));

  try {
    const user = await registerUser(password, team_id, name, team_name, email, timezone, team_member_id, discord_id);
    sendWelcomeEmail(email, name);
    return done(null, user, req.flash(SUCCESS_KEY, "Registration successful. Please check your email for verification."));
  } catch (error: any) {
    const message = (error?.message) || "";

    if (message === "ERROR_INVALID_JOINING_EMAIL") {
      return done(null, null, req.flash(ERROR_KEY, `No invitations found for email ${req.body.email}.`));
    }

    // if error.message is "email already exists" then it should have the email address in the error message after ":".
    if (message.includes("EMAIL_EXISTS_ERROR") || error.constraint === "users_google_id_uindex") {
      const [, value] = error.message.split(":");
      return done(null, null, req.flash(ERROR_KEY, `Worklenz account already exists for email ${value}.`));
    }


    if (message.includes("TEAM_NAME_EXISTS_ERROR")) {
      const [, value] = error.message.split(":");
      return done(null, null, req.flash(ERROR_KEY, `Team name "${value}" already exists. Please choose a different team name.`));
    }

    // The Team name is already taken.
    if (error.constraint === "teams_url_uindex" || error.constraint === "teams_name_uindex") {
      return done(null, null, req.flash(ERROR_KEY, `Team name "${team_name}" is already taken. Please choose a different team name.`));
    }

    log_error(error, req.body);
    return done(null, null, req.flash(ERROR_KEY, DEFAULT_ERROR_MESSAGE));
  }
}

export default new LocalStrategy({
  usernameField: "email",
  passwordField: "password",
  passReqToCallback: true
}, (req, email, password, done) => void handleSignUp(req, email, password, done));
