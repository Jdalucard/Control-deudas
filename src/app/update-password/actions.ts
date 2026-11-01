"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import { requireUser } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

export async function updatePassword(formData: FormData) {
  try {
    await requireUser();
    const password = String(formData.get("password") ?? "");
    if (password.length < 8) redirect("/update-password?m=password_corta");

    const supabase = await createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      console.error("updatePassword:", error.status, error.message);
      redirect("/update-password?m=generico");
    }

    redirect("/");
  } catch (err) {
    unstable_rethrow(err);
    console.error("updatePassword: error inesperado", err);
    redirect("/update-password?m=generico");
  }
}
