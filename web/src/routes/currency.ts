import { Hono } from "hono";

const currencyRouter = new Hono();

interface ExchangeRateResponse {
  result: string;
  base_code: string;
  rates: Record<string, number>;
  time_last_update_utc: string;
}

interface CachedRates {
  rates: Record<string, number>;
  base: string;
  lastUpdated: string;
  fetchedAt: number;
}

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const ratesCache = new Map<string, CachedRates>();

async function fetchRates(base: string): Promise<CachedRates> {
  const cached = ratesCache.get(base);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached;
  }

  const url = `https://open.er-api.com/v6/latest/${base}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch exchange rates: ${response.statusText}`);
  }

  const data = (await response.json()) as ExchangeRateResponse;

  if (data.result !== "success") {
    throw new Error("Exchange rate API returned an error");
  }

  const entry: CachedRates = {
    rates: data.rates,
    base: data.base_code,
    lastUpdated: data.time_last_update_utc,
    fetchedAt: Date.now(),
  };

  ratesCache.set(base, entry);
  return entry;
}

// GET /api/currencies - list supported currencies
currencyRouter.get("/currencies", async (c) => {
  try {
    const data = await fetchRates("USD");
    const currencies = Object.keys(data.rates).sort();
    return c.json({ currencies });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json({ error: message }, 500);
  }
});

// GET /api/rates?base=USD - get all rates for a base currency
currencyRouter.get("/rates", async (c) => {
  const base = (c.req.query("base") ?? "USD").toUpperCase();

  try {
    const data = await fetchRates(base);
    return c.json({
      base: data.base,
      lastUpdated: data.lastUpdated,
      rates: data.rates,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json({ error: message }, 500);
  }
});

// GET /api/convert?from=USD&to=EUR&amount=100 - convert between currencies
currencyRouter.get("/convert", async (c) => {
  const from = (c.req.query("from") ?? "").toUpperCase();
  const to = (c.req.query("to") ?? "").toUpperCase();
  const amountStr = c.req.query("amount") ?? "";

  if (!from || !to || !amountStr) {
    return c.json(
      { error: "Missing required parameters: from, to, amount" },
      400
    );
  }

  const amount = parseFloat(amountStr);
  if (isNaN(amount) || amount < 0) {
    return c.json({ error: "Invalid amount" }, 400);
  }

  try {
    const data = await fetchRates(from);

    if (!(to in data.rates)) {
      return c.json({ error: `Unsupported target currency: ${to}` }, 400);
    }

    const rate = data.rates[to];
    const converted = amount * rate;

    return c.json({
      from,
      to,
      amount,
      rate,
      converted: Math.round(converted * 100) / 100,
      lastUpdated: data.lastUpdated,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json({ error: message }, 500);
  }
});

export { currencyRouter };
