"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

export async function updatePassword(formData: FormData) {
  await requireUser();
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) redirect("/actualizar-contrasena?m=password_corta");

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirect("/actualizar-contrasena?m=generico");

  redirect("/");
}
