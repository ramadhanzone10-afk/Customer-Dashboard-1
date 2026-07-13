const REQUIRED_IN_PRODUCTION: Record<string, string> = {
  DATABASE_URL: "PostgreSQL connection string (e.g. postgres://user:pass@host/db)",
};

const OPTIONAL_WITH_DEFAULTS: Record<string, string> = {
  ALLOWED_ORIGINS: "Comma-separated list of allowed CORS origins (default: all)",
  NODE_ENV: "Runtime environment: 'development' or 'production'",
  PORT: "Port to listen on (default: 8080)",
};

export function validateEnv(): void {
  const isProduction = process.env.NODE_ENV === "production";
  const missing: { key: string; description: string }[] = [];

  for (const [key, description] of Object.entries(REQUIRED_IN_PRODUCTION)) {
    if (!process.env[key]) {
      missing.push({ key, description });
    }
  }

  if (missing.length > 0) {
    const lines = [
      "",
      "╔══════════════════════════════════════════════════════════════╗",
      "║          MISSING REQUIRED ENVIRONMENT VARIABLES              ║",
      "╚══════════════════════════════════════════════════════════════╝",
      "",
      "The following environment variables must be set before starting:",
      "",
      ...missing.map(({ key, description }) => `  • ${key}\n    → ${description}`),
      "",
      "How to fix:",
      "  • On Vercel: Go to Project Settings → Environment Variables",
      "  • Locally:   Create a .env file or export the variables",
      "",
    ];

    if (isProduction) {
      console.error(lines.join("\n"));
      process.exit(1);
    } else {
      console.warn(lines.join("\n"));
      console.warn("⚠️  Running in development mode with missing env vars — some features may not work.\n");
    }
  }
}

export function getEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `Environment variable "${key}" is not set.\n` +
      `Add it to your Vercel project settings or .env file.`
    );
  }
  return value;
}
