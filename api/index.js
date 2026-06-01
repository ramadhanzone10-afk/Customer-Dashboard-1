// Vercel serverless entry point — imports the bundled Express app
// Built during: pnpm --filter @workspace/api-server run build
import app from "../artifacts/api-server/dist/vercel.mjs";
export default app;
