import { defineApp } from "convex/server";
import betterAuth from "@convex-dev/better-auth/convex.config";
import r2 from "@convex-dev/r2/convex.config.js";
import resend from "@convex-dev/resend/convex.config.js";
import stripe from "@convex-dev/stripe/convex.config.js";

const app = defineApp();
app.use(betterAuth);
app.use(resend);
app.use(r2);
app.use(stripe);

export default app;
