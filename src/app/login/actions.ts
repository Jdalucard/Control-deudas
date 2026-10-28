"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function credentials(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  return { email, password };
}

async function siteUrl() {
  const h = await headers();
  return process.env.NEXT_PUBLIC_SITE_URL || h.get("origin") || "http://localhost:3000";
}

export async function signIn(formData: FormData) {
  const { email, password } = credentials(formData);
  if (!email || !password) redirect("/login?m=campos");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect("/login?m=credenciales");
  redirect("/");
}

export async function signUp(formData: FormData) {
  const { email, password } = credentials(formData);
  if (!email || !password) redirect("/login?m=campos");
  if (password.length < 8) redirect("/login?m=password_corta");
  const site = await siteUrl();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${site}/auth/callback` },
  });
  if (error) {
    console.error("signUp:", error.status, error.message);
    redirect("/login?m=generico");
  }
  if (data.session) redirect("/");
  redirect("/login?m=confirma_correo");
}

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) redirect("/login/forgot-password?m=campos");
  const site = await siteUrl();
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${site}/auth/callback?next=/update-password`,
  });
  if (error) console.error("resetPasswordForEmail:", error.status, error.message);
  // No confirmamos si el correo existe o no, para no revelar cuentas registradas.
  redirect("/login/forgot-password?m=recuperar_enviado");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
