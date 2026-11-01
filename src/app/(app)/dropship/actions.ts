"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { requireUser } from "@/lib/data";
import { parseAmount } from "@/lib/finance";
import { DATE_RE } from "@/lib/money";
import { HOOKS, PHASES, STATUSES, type AdSpendPhase, type Hook } from "@/lib/dropship";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

function revalidateProduct(id: string) {
  revalidatePath(`/dropship/products/${id}`);
  revalidatePath("/dropship/products");
  revalidatePath("/dropship/effectiveness");
}

function readPhoto(formData: FormData): File | null {
  const entry = formData.get("photo");
  return entry instanceof File && entry.size > 0 ? entry : null;
}

/** Sube la foto a Storage y devuelve la ruta guardada, o null si el archivo no es válido. */
async function uploadProductPhoto(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  productId: string,
  photo: File,
): Promise<string | null> {
  if (!ALLOWED_PHOTO_TYPES.includes(photo.type) || photo.size > MAX_PHOTO_BYTES) return null;
  const safeName = photo.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80) || "foto";
  const path = `${userId}/${productId}/${Date.now()}-${safeName}`;
  const buffer = Buffer.from(await photo.arrayBuffer());
  const { error } = await supabase.storage.from("dropship-photos").upload(path, new Blob([buffer], { type: photo.type }), {
    contentType: photo.type,
    upsert: false,
  });
  if (error) {
    console.error("uploadProductPhoto:", error.message);
    return null;
  }
  return path;
}

export async function createProduct(formData: FormData) {
  try {
    const user = await requireUser();
    const name = String(formData.get("name") ?? "").trim();
    const cost = parseAmount(String(formData.get("cost_cop") ?? ""));
    const price = parseAmount(String(formData.get("price_cop") ?? ""));
    if (!name) redirect("/dropship/products?m=campos");
    if (!cost || cost <= 0 || !price || price <= 0) redirect("/dropship/products?m=monto_invalido");

    const photo = readPhoto(formData);

    const supabase = await createClient();
    const { data: product, error } = await supabase
      .from("dropship_products")
      .insert({ user_id: user.id, name, cost_cop: cost, price_cop: price })
      .select("id")
      .single();
    if (error || !product) {
      console.error("createProduct:", error?.code, error?.message);
      redirect("/dropship/products?m=generico");
    }

    if (photo) {
      const photoPath = await uploadProductPhoto(supabase, user.id, product.id, photo);
      if (photoPath) await supabase.from("dropship_products").update({ photo_path: photoPath }).eq("id", product.id);
    }

    revalidatePath("/dropship/products");
    redirect(`/dropship/products/${product.id}?m=producto_ok`);
  } catch (err) {
    unstable_rethrow(err);
    console.error("createProduct: error inesperado", err);
    redirect("/dropship/products?m=generico");
  }
}

export async function updateProduct(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  try {
    const user = await requireUser();
    const name = String(formData.get("name") ?? "").trim();
    const dropiUrl = String(formData.get("dropi_url") ?? "").trim() || null;
    const category = String(formData.get("category") ?? "").trim() || null;
    const cost = parseAmount(String(formData.get("cost_cop") ?? ""));
    const price = parseAmount(String(formData.get("price_cop") ?? ""));
    const shipping = parseAmount(String(formData.get("shipping_cop") ?? "")) ?? 16000;
    const returnShipping = parseAmount(String(formData.get("return_shipping_cop") ?? "")) ?? 16000;
    const stockRaw = String(formData.get("stock_available") ?? "").trim();
    const stock = stockRaw ? Math.round(parseAmount(stockRaw) ?? 0) : null;
    const hasVideo = formData.get("has_video") === "on";
    const notInRetail = formData.get("not_in_retail") === "on";
    const noSizeOrFragile = formData.get("no_size_or_fragile") === "on";

    const score = (field: string) => {
      const raw = String(formData.get(field) ?? "");
      const n = Number(raw);
      return raw !== "" && Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
    };

    const status = String(formData.get("status") ?? "evaluando");
    const notes = String(formData.get("notes") ?? "").trim().slice(0, 500) || null;

    if (!id) redirect("/dropship/products?m=generico");
    if (!name) redirect(`/dropship/products/${id}?m=campos`);
    if (!cost || cost <= 0 || !price || price <= 0) redirect(`/dropship/products/${id}?m=monto_invalido`);
    if (!STATUSES.includes(status as (typeof STATUSES)[number])) redirect(`/dropship/products/${id}?m=campos`);

    const photo = readPhoto(formData);
    const supabase = await createClient();
    const photoPath = photo ? await uploadProductPhoto(supabase, user.id, id, photo) : null;

    const { error } = await supabase
      .from("dropship_products")
      .update({
        name,
        dropi_url: dropiUrl,
        category,
        cost_cop: cost,
        price_cop: price,
        shipping_cop: shipping,
        return_shipping_cop: returnShipping,
        stock_available: stock,
        has_video: hasVideo,
        not_in_retail: notInRetail,
        no_size_or_fragile: noSizeOrFragile,
        score_wow: score("score_wow"),
        score_pain: score("score_pain"),
        score_logistics: score("score_logistics"),
        score_impulse: score("score_impulse"),
        score_saturation: score("score_saturation"),
        status,
        notes,
        ...(photoPath ? { photo_path: photoPath } : {}),
      })
      .eq("id", id);
    if (error) {
      console.error("updateProduct:", error.code, error.message);
      redirect(`/dropship/products/${id}?m=generico`);
    }
    revalidateProduct(id);
    redirect(`/dropship/products/${id}?m=producto_ok`);
  } catch (err) {
    unstable_rethrow(err);
    console.error("updateProduct: error inesperado", err);
    redirect(`/dropship/products/${id || ""}?m=generico`);
  }
}

export async function deleteProduct(formData: FormData) {
  try {
    await requireUser();
    const id = String(formData.get("id") ?? "");
    const reason = String(formData.get("deleted_reason") ?? "").trim().slice(0, 300);
    if (!id) redirect("/dropship/products?m=generico");
    if (!reason) redirect(`/dropship/products/${id}?m=motivo_requerido`);

    const supabase = await createClient();
    const { error } = await supabase
      .from("dropship_products")
      .update({ archived: true, deleted_at: new Date().toISOString(), deleted_reason: reason })
      .eq("id", id);
    if (error) {
      console.error("deleteProduct:", error.code, error.message);
      redirect(`/dropship/products/${id}?m=generico`);
    }
    revalidateProduct(id);
    redirect("/dropship/products?m=producto_eliminado");
  } catch (err) {
    unstable_rethrow(err);
    console.error("deleteProduct: error inesperado", err);
    redirect("/dropship/products?m=generico");
  }
}

export async function reactivateProduct(formData: FormData) {
  try {
    await requireUser();
    const id = String(formData.get("id") ?? "");
    if (!id) redirect("/dropship/products?m=generico");
    const supabase = await createClient();
    const { error } = await supabase
      .from("dropship_products")
      .update({ archived: false, deleted_at: null, deleted_reason: null })
      .eq("id", id);
    if (error) {
      console.error("reactivateProduct:", error.code, error.message);
      redirect("/dropship/products?m=generico");
    }
    revalidateProduct(id);
    redirect("/dropship/products?m=producto_reactivado");
  } catch (err) {
    unstable_rethrow(err);
    console.error("reactivateProduct: error inesperado", err);
    redirect("/dropship/products?m=generico");
  }
}

export async function addAdSpendDay(formData: FormData) {
  const productId = String(formData.get("product_id") ?? "");
  try {
    const user = await requireUser();
    const spentOn = String(formData.get("spent_on") ?? "");
    const amount = parseAmount(String(formData.get("amount_cop") ?? ""));
    const ordersCreated = Math.max(0, Math.round(Number(formData.get("orders_created") ?? 0) || 0));
    const phase = String(formData.get("phase") ?? "prueba");
    const hookRaw = String(formData.get("hook") ?? "");
    const hook = hookRaw && HOOKS.includes(hookRaw as Hook) ? (hookRaw as Hook) : null;
    const note = String(formData.get("note") ?? "").trim().slice(0, 300) || null;

    if (!productId) redirect("/dropship/products?m=generico");
    if (!DATE_RE.test(spentOn)) redirect(`/dropship/products/${productId}?m=campos`);
    if (!amount || amount <= 0) redirect(`/dropship/products/${productId}?m=monto_invalido`);
    if (!PHASES.includes(phase as AdSpendPhase)) redirect(`/dropship/products/${productId}?m=campos`);

    const supabase = await createClient();
    const { error } = await supabase.from("dropship_ad_spend").insert({
      user_id: user.id,
      product_id: productId,
      spent_on: spentOn,
      amount_cop: amount,
      orders_created: ordersCreated,
      phase,
      hook,
      note,
    });
    if (error) {
      console.error("addAdSpendDay:", error.code, error.message);
      redirect(`/dropship/products/${productId}?m=generico`);
    }
    revalidateProduct(productId);
    redirect(`/dropship/products/${productId}?m=gasto_pauta_ok`);
  } catch (err) {
    unstable_rethrow(err);
    console.error("addAdSpendDay: error inesperado", err);
    redirect(`/dropship/products/${productId || ""}?m=generico`);
  }
}

export async function deleteAdSpendDay(formData: FormData) {
  const productId = String(formData.get("product_id") ?? "");
  try {
    await requireUser();
    const id = String(formData.get("id") ?? "");
    if (!id) redirect(`/dropship/products/${productId}?m=generico`);
    const supabase = await createClient();
    const { error } = await supabase.from("dropship_ad_spend").delete().eq("id", id);
    if (error) {
      console.error("deleteAdSpendDay:", error.code, error.message);
      redirect(`/dropship/products/${productId}?m=generico`);
    }
    revalidateProduct(productId);
    redirect(`/dropship/products/${productId}?m=gasto_pauta_borrado`);
  } catch (err) {
    unstable_rethrow(err);
    console.error("deleteAdSpendDay: error inesperado", err);
    redirect(`/dropship/products/${productId || ""}?m=generico`);
  }
}

export async function addOrderBatch(formData: FormData) {
  const productId = String(formData.get("product_id") ?? "");
  try {
    const user = await requireUser();
    const periodStart = String(formData.get("period_start") ?? "");
    const periodEnd = String(formData.get("period_end") ?? "");
    const int = (field: string) => Math.max(0, Math.round(Number(formData.get(field) ?? 0) || 0));
    const ordersCreated = int("orders_created");
    const ordersConfirmed = int("orders_confirmed");
    const ordersDispatched = int("orders_dispatched");
    const ordersDelivered = int("orders_delivered");
    const ordersReturned = int("orders_returned");
    const note = String(formData.get("note") ?? "").trim().slice(0, 300) || null;

    if (!productId) redirect("/dropship/products?m=generico");
    if (!DATE_RE.test(periodStart) || !DATE_RE.test(periodEnd) || periodEnd < periodStart) {
      redirect(`/dropship/products/${productId}?m=campos`);
    }
    if (ordersCreated <= 0) redirect(`/dropship/products/${productId}?m=campos`);
    if (ordersDelivered + ordersReturned > ordersCreated) redirect(`/dropship/products/${productId}?m=tanda_invalida`);

    const supabase = await createClient();
    const { error } = await supabase.from("dropship_order_batches").insert({
      user_id: user.id,
      product_id: productId,
      period_start: periodStart,
      period_end: periodEnd,
      orders_created: ordersCreated,
      orders_confirmed: ordersConfirmed,
      orders_dispatched: ordersDispatched,
      orders_delivered: ordersDelivered,
      orders_returned: ordersReturned,
      note,
    });
    if (error) {
      console.error("addOrderBatch:", error.code, error.message);
      redirect(`/dropship/products/${productId}?m=generico`);
    }
    revalidateProduct(productId);
    redirect(`/dropship/products/${productId}?m=tanda_ok`);
  } catch (err) {
    unstable_rethrow(err);
    console.error("addOrderBatch: error inesperado", err);
    redirect(`/dropship/products/${productId || ""}?m=generico`);
  }
}

export async function deleteOrderBatch(formData: FormData) {
  const productId = String(formData.get("product_id") ?? "");
  try {
    await requireUser();
    const id = String(formData.get("id") ?? "");
    if (!id) redirect(`/dropship/products/${productId}?m=generico`);
    const supabase = await createClient();
    const { error } = await supabase.from("dropship_order_batches").delete().eq("id", id);
    if (error) {
      console.error("deleteOrderBatch:", error.code, error.message);
      redirect(`/dropship/products/${productId}?m=generico`);
    }
    revalidateProduct(productId);
    redirect(`/dropship/products/${productId}?m=tanda_borrada`);
  } catch (err) {
    unstable_rethrow(err);
    console.error("deleteOrderBatch: error inesperado", err);
    redirect(`/dropship/products/${productId || ""}?m=generico`);
  }
}
