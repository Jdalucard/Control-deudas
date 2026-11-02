"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import { requireUser } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

export async function createHousehold(formData: FormData) {
  try {
    await requireUser();
    const name = String(formData.get("name") ?? "").trim() || "Mi grupo";
    const supabase = await createClient();
    const { error } = await supabase.rpc("create_household", { p_name: name });
    if (error) {
      const known = error.message.includes("Ya perteneces");
      if (!known) console.error("createHousehold:", error.message);
      redirect(`/onboarding?m=${known ? "ya_hogar" : "generico"}`);
    }
    redirect("/");
  } catch (err) {
    unstable_rethrow(err);
    console.error("createHousehold: error inesperado", err);
    redirect("/onboarding?m=generico");
  }
}

export async function joinHousehold(formData: FormData) {
  try {
    await requireUser();
    const code = String(formData.get("code") ?? "").trim();
    if (!code) redirect("/onboarding?m=campos");
    const supabase = await createClient();
    const { error } = await supabase.rpc("join_household", { p_code: code });
    if (error) {
      const known = error.message.includes("inválido") || error.message.includes("Ya perteneces");
      if (!known) console.error("joinHousehold:", error.message);
      redirect(
        `/onboarding?m=${error.message.includes("inválido") ? "codigo_invalido" : error.message.includes("Ya perteneces") ? "ya_hogar" : "generico"}`,
      );
    }
    redirect("/");
  } catch (err) {
    unstable_rethrow(err);
    console.error("joinHousehold: error inesperado", err);
    redirect("/onboarding?m=generico");
  }
}
