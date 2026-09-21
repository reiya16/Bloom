// supabase/functions/food-search/index.ts
//
// Searches the USDA FoodData Central database for the Eat tab.
// The USDA key stays here on the server (secret name: USDA_API_KEY), never in the app.
// Returns nutrition per 100 g for each food, plus whether the entry is raw or cooked.

const USDA_KEY = Deno.env.get("USDA_API_KEY");
const USDA_BASE = Deno.env.get("USDA_BASE_URL") ?? "https://api.nal.usda.gov/fdc/v1";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...CORS } });

type FoodState = "raw" | "cooked" | "unknown";
interface Hit {
  fdcId: number;
  name: string;
  brand: string | null;
  dataType: string;
  state: FoodState;
  per100g: { calories: number; protein: number; carbs: number; fat: number };
  servingG: number | null;
  servingText: string | null;
}

const IDS = { kcal: [1008, 2047, 2048], protein: [1003], fat: [1004], carbs: [1005] };

function nutrient(list: any[], ids: number[]): number | null {
  for (const id of ids) {
    const n = list.find((x) => (x.nutrientId ?? x.nutrient?.id) === id);
    const v = n?.value ?? n?.amount;
    if (typeof v === "number" && isFinite(v)) return v;
  }
  return null;
}

function detectState(desc: string): FoodState {
  const d = desc.toLowerCase();
  if (/\b(raw|uncooked)\b/.test(d)) return "raw";
  if (/\b(cooked|roasted|boiled|baked|grilled|fried|steamed|broiled|braised|stewed|toasted|microwaved)\b/.test(d)) return "cooked";
  return "unknown";
}

function niceName(s: string): string {
  const t = s.trim();
  if (t !== t.toUpperCase()) return t;
  return t.toLowerCase().replace(/(^|[\s(,/-])([a-z])/g, (_m, a, b) => a + b.toUpperCase());
}

const round1 = (n: number) => Math.round(n * 10) / 10;

function toHit(f: any): Hit | null {
  if (!f || typeof f.fdcId !== "number" || typeof f.description !== "string") return null;
  const list: any[] = f.foodNutrients ?? [];
  const protein = nutrient(list, IDS.protein) ?? 0;
  const fat = nutrient(list, IDS.fat) ?? 0;
  const carbs = nutrient(list, IDS.carbs) ?? 0;
  let kcal = nutrient(list, IDS.kcal);
  if (kcal == null) kcal = protein * 4 + carbs * 4 + fat * 9; // some entries only list macros
  const unit = String(f.servingSizeUnit ?? "").toLowerCase();
  const servingG = typeof f.servingSize === "number" && (unit === "g" || unit === "grm") ? f.servingSize : null;
  return {
    fdcId: f.fdcId,
    name: niceName(f.description),
    brand: f.brandName || f.brandOwner ? niceName(String(f.brandName ?? f.brandOwner)) : null,
    dataType: String(f.dataType ?? ""),
    state: detectState(f.description),
    per100g: { calories: Math.round(kcal), protein: round1(protein), carbs: round1(carbs), fat: round1(fat) },
    servingG,
    servingText: typeof f.householdServingFullText === "string" && f.householdServingFullText ? f.householdServingFullText : null
  };
}

async function usda(query: string, dataTypes: string[], pageSize: number): Promise<any[]> {
  const url = new URL(`${USDA_BASE}/foods/search`);
  url.searchParams.set("api_key", USDA_KEY as string);
  url.searchParams.set("query", query);
  url.searchParams.set("dataType", dataTypes.join(","));
  url.searchParams.set("pageSize", String(pageSize));
  const res = await fetch(url);
  if (!res.ok) throw new Error(`The food database answered with an error (${res.status}).`);
  const data = await res.json();
  return Array.isArray(data?.foods) ? data.foods : [];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (!req.headers.get("Authorization")) return json({ error: "Please sign in again." }, 401);
  try {
    const body = await req.json().catch(() => ({}));
    const query = typeof body?.query === "string" ? body.query.trim() : "";
    if (query.length < 2 || query.length > 80) return json({ error: "Type at least 2 letters to search." }, 400);
    if (!USDA_KEY) return json({ error: "Food search isn't set up yet (the USDA key is missing)." }, 500);

    // everyday foods first (they include raw and cooked versions), then packaged products
    const [generic, branded] = await Promise.all([
      usda(query, ["Foundation", "SR Legacy", "Survey (FNDDS)"], 20),
      usda(query, ["Branded"], 10).catch(() => [])
    ]);
    const seen = new Set<number>();
    const foods: Hit[] = [];
    for (const f of [...generic.slice(0, 15), ...branded.slice(0, 8)]) {
      const h = toHit(f);
      if (h && !seen.has(h.fdcId)) {
        seen.add(h.fdcId);
        foods.push(h);
      }
    }
    return json({ foods });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Food search failed." }, 502);
  }
});
