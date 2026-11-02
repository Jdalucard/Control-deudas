import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decide, marginDelivered, scoreTotal, type DropshipProduct } from "@/lib/dropship";
import {
  dailySeries,
  groupSpendByProduct,
  matchesRangeFilters,
  ordersInWindow,
  parseRangeFilters,
  type RadarFilter,
  type RadarSort,
} from "@/lib/radar";

const SPARKLINE_DAYS = 30;

const PRODUCT_COLUMNS =
  "id, name, dropi_url, category, cost_cop, price_cop, shipping_cop, return_shipping_cop, stock_available, photo_path, has_video, not_in_retail, no_size_or_fragile, score_wow, score_pain, score_logistics, score_impulse, score_saturation, status, notes, archived, deleted_at, deleted_reason, created_at";

function numifyProduct(p: Record<string, unknown>): DropshipProduct {
  return {
    ...p,
    cost_cop: Number(p.cost_cop),
    price_cop: Number(p.price_cop),
    shipping_cop: Number(p.shipping_cop),
    return_shipping_cop: Number(p.return_shipping_cop),
  } as DropshipProduct;
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim().toLowerCase();
  const sort = (searchParams.get("sort") ?? "created_desc") as RadarSort;
  const filter = (searchParams.get("filter") ?? "all") as RadarFilter;
  const range = parseRangeFilters(searchParams);
  // "Totales" sale de la vista agregada por SQL (dropship_product_totals), no de sumar filas en JS:
  // así el costo de la consulta no crece con los años de historial que acumule el usuario.
  const sparklineSince = new Date(Date.now() - SPARKLINE_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [{ data: productsRaw, error: productsError }, { data: spendRaw, error: spendError }, { data: totalsRaw, error: totalsError }] =
    await Promise.all([
      supabase.from("dropship_products").select(PRODUCT_COLUMNS).eq("archived", false),
      supabase.from("dropship_ad_spend").select("product_id, spent_on, orders_created").gte("spent_on", sparklineSince),
      supabase.from("dropship_product_totals").select("product_id, total_spent, total_orders_created_ads, total_orders_logged, total_delivered, total_returned"),
    ]);

  if (productsError || spendError || totalsError) {
    console.error("GET /api/dropship/radar:", productsError ?? spendError ?? totalsError);
    return NextResponse.json({ error: "No se pudo cargar el radar" }, { status: 500 });
  }

  const products = (productsRaw ?? []).map(numifyProduct);
  const spendByProduct = groupSpendByProduct(spendRaw ?? []);
  const totalsByProduct = new Map((totalsRaw ?? []).map((t) => [t.product_id, { ...t, total_spent: Number(t.total_spent) }]));

  let rows = products.map((p) => {
    const total = totalsByProduct.get(p.id) ?? {
      product_id: p.id,
      total_spent: 0,
      total_orders_created_ads: 0,
      total_orders_logged: 0,
      total_delivered: 0,
      total_returned: 0,
    };
    const spend = spendByProduct.get(p.id) ?? [];
    return {
      product: p,
      score: scoreTotal(p),
      margin: marginDelivered(p),
      decision: decide(p, total),
      ventas7d: ordersInWindow(spend, 7),
      ventas30d: ordersInWindow(spend, 30),
      ventasTotal: total.total_orders_created_ads,
      sparkline: dailySeries(spend, SPARKLINE_DAYS),
    };
  });

  if (q) rows = rows.filter((r) => r.product.name.toLowerCase().includes(q) || (r.product.category ?? "").toLowerCase().includes(q));
  if (filter === "sin_escalar") rows = rows.filter((r) => r.decision.level === "sin_datos" || r.decision.level === "mantener");
  if (filter === "mas_vendidos") rows = rows.filter((r) => r.ventasTotal > 0);
  rows = rows.filter((r) =>
    matchesRangeFilters(
      {
        category: r.product.category,
        status: r.product.status,
        stock: r.product.stock_available,
        price: r.product.price_cop,
        createdAt: r.product.created_at,
        ventas7d: r.ventas7d,
        ventas30d: r.ventas30d,
        ventasTotal: r.ventasTotal,
      },
      range,
    ),
  );

  const sorters: Record<RadarSort, (a: (typeof rows)[number], b: (typeof rows)[number]) => number> = {
    created_desc: (a, b) => b.product.created_at.localeCompare(a.product.created_at),
    week_desc: (a, b) => b.ventas7d - a.ventas7d,
    month_desc: (a, b) => b.ventas30d - a.ventas30d,
    total_desc: (a, b) => b.ventasTotal - a.ventasTotal,
    name_asc: (a, b) => a.product.name.localeCompare(b.product.name),
  };
  rows.sort(sorters[sort] ?? sorters.created_desc);

  return NextResponse.json({ rows }, { headers: { "Cache-Control": "private, no-store" } });
}
