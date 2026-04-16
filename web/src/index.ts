import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "@hono/node-server/serve-static";
import { serve } from "@hono/node-server";
import { currencyRouter } from "./routes/currency";

const app = new Hono();

app.use("/*", cors());

app.route("/api", currencyRouter);

app.use("/*", serveStatic({ root: "./public" }));

app.get("/", serveStatic({ path: "./public/index.html" }));

const port = 3000;
console.log(`Server is running on http://localhost:${port}`);

serve({
  fetch: app.fetch,
  port,
});
