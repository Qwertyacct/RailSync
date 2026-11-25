// Usage: node scripts/create-admin.js "Admin Name" admin@example.com 9876543210
require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../src/config/db');

async function main() {
  const [full_name, email, phone] = process.argv.slice(2);
  if (!full_name || !email || !phone) {
    console.error('Usage: node scripts/create-admin.js "Admin Name" admin@example.com 9876543210');
    process.exitCode = 1; return;
  }
  const password = require('crypto').randomBytes(12).toString('base64url');
  const password_hash = await bcrypt.hash(password, 12);
  const [r] = await db.execute(
    "INSERT INTO users (full_name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, 'ADMIN')",
    [full_name, email, phone, password_hash]
  );
  console.log('Admin created:', r.insertId, '\nTemporary password:', password);
  await db.end();
}
main().catch((err) => { console.error(err); process.exit(1); });
