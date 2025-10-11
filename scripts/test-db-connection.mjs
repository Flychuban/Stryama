import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  log: ["query", "error", "warn"],
});

async function testConnection() {
  try {
    console.log("Testing database connection...");
    await prisma.$queryRaw`SELECT 1`;
    console.log("✓ Database connection successful");

    // Test creating a simple query to verify schema
    const userCount = await prisma.user.count();
    console.log(
      `✓ Schema verified - User table accessible (count: ${userCount})`,
    );

    await prisma.$disconnect();
    console.log("✓ Database disconnected successfully");
    process.exit(0);
  } catch (error) {
    console.error("✗ Database connection failed:", error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

testConnection();
