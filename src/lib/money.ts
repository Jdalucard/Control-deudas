import "server-only";
import { createClient } from "@/lib/supabase/server";

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function insertMoneyMovement(input: {
  userId: string;
  accountId: string;
  kind: "ingreso" | "gasto";
  amount: number;
  occurredOn: string;
  category: string | null;
  note: string | null;
}) {
  const supabase = await createClient();
  return supabase.from("money_movements").insert({
    user_id: input.userId,
    account_id: input.accountId,
    kind: input.kind,
    amount: input.amount,
    occurred_on: input.occurredOn,
    category: input.category,
    note: input.note,
  });
}

export async function deleteMoneyMovement(id: string) {
  const supabase = await createClient();
  return supabase.from("money_movements").delete().eq("id", id);
}
