const { existsSync, readFileSync, unlinkSync } = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const dbPath = path.join(root, "prisma", "dev.db");
const sqlPath = path.join(root, "scripts", "create-template-db.sql");

if (existsSync(dbPath)) {
  unlinkSync(dbPath);
}

process.env.DATABASE_URL = `file:${dbPath.replace(/\\/g, "/")}`;

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const sql = readFileSync(sqlPath, "utf8");
const statements = sql
  .split(";")
  .map((statement) => statement.trim())
  .filter(Boolean);

async function main() {
  for (const statement of statements) {
    await prisma.$executeRawUnsafe(statement);
  }

  console.log(`Created SQLite template database at ${dbPath}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
