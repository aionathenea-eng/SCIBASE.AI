import { hashPassword } from "../auth.js";

const password = process.argv[2];
if (!password) {
  console.error("Uso: node scripts/hash-password.mjs \"a-tua-password\"");
  process.exit(1);
}

const { salt, hash } = hashPassword(password);
console.log("PASSWORD_SALT=" + salt);
console.log("PASSWORD_HASH=" + hash);
