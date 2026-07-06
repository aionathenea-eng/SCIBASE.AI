import { scryptSync, timingSafeEqual, randomBytes } from "node:crypto";

const USERS = ["andre", "cristina"];

export function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return { salt, hash };
}

function verifyPassword(password, salt, expectedHashHex) {
  if (!salt || !expectedHashHex) return false;
  const hash = scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHashHex, "hex");
  if (hash.length !== expected.length) return false;
  return timingSafeEqual(hash, expected);
}

function credsFor(username) {
  const key = username.toUpperCase();
  return {
    salt: process.env[`${key}_PASSWORD_SALT`],
    hash: process.env[`${key}_PASSWORD_HASH`],
  };
}

export function checkLogin(username, password) {
  if (!USERS.includes(username)) return false;
  const { salt, hash } = credsFor(username);
  return verifyPassword(String(password || ""), salt, hash);
}

function checkBearerToken(req) {
  const header = req.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return false;
  const token = match[1].trim();
  const expected = process.env.CRM_API_TOKEN || "";
  if (!expected || token.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}

// Aceita sessão de browser (Andre/Cristina) OU Bearer token (Codex / integrações).
export function requireAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  if (checkBearerToken(req)) return next();
  res.status(401).json({ error: "Não autenticado." });
}

export { USERS };
