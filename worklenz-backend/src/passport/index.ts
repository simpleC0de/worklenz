import {PassportStatic} from "passport";

import {deserialize} from "./deserialize";
import {serialize} from "./serialize";

import LocalLogin from "./passport-strategies/passport-local-login";
import LocalSignup from "./passport-strategies/passport-local-signup";

/**
 * Use any passport middleware before the serialize and deserialize
 * @param {Passport} passport
 */
export default (passport: PassportStatic) => {
  passport.use("local-login", LocalLogin);
  passport.use("local-signup", LocalSignup);

  // Only register Google OAuth if credentials are provided
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    const GoogleLogin = require("./passport-strategies/passport-google").default;
    const GoogleMobileLogin = require("./passport-strategies/passport-google-mobile").default;
    passport.use(GoogleLogin);
    passport.use("google-mobile", GoogleMobileLogin);
  }

  // Only register Discord OAuth if credentials are provided
  if (process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET) {
    const DiscordLogin = require("./passport-strategies/passport-discord").default;
    passport.use("discord", DiscordLogin);
  }

  passport.serializeUser(serialize);
  passport.deserializeUser(deserialize);
};
