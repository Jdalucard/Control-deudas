"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

export async function createHousehold(formData: FormData) {
  await requireUser();
  const name = String(formData.get("name") ?? "").trim() || "Mi hogar";
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_household", { p_name: name });
  if (error) redirect(`/onboarding?m=${error.message.includes("Ya perteneces") ? "ya_hogar" : "generico"}`);
  redirect("/");
}

export async function joinHousehold(formData: FormData) {
  await requireUser();
  const code = String(formData.get("code") ?? "").trim();
  if (!code) redirect("/onboarding?m=campos");
  const supabase = await createClient();
  const { error } = await supabase.rpc("join_household", { p_code: code });
  if (error) redirect(`/onboarding?m=${error.message.includes("inválido") ? "codigo_invalido" : error.message.includes("Ya perteneces") ? "ya_hogar" : "generico"}`);
  redirect("/");
}
