import path from "node:path";

process.env.DATABASE_URL = "file:./test.db";
process.env.SESSION_SECRET = "test-secret-test-secret-test-secret-1234";
process.env.ANTHROPIC_API_KEY = "";
process.env.FDC_API_KEY = "";
process.env.UPLOAD_DIR = path.resolve(__dirname, "../storage/test-uploads");
process.env.ADMIN_EMAILS = "admin@example.com";
(process.env as Record<string, string>).NODE_ENV = "test";
