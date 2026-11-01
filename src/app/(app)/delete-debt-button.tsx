"use client";

import { deleteDebt } from "./actions";

export function DeleteDebtButton({ debtId, debtName }: { debtId: string; debtName: string }) {
  return (
    <form
      action={deleteDebt}
      onSubmit={(e) => {
        if (!confirm(`¿Eliminar "${debtName}"? Esto no se puede deshacer.`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={debtId} />
      <button className="text-danger hover:underline">Eliminar</button>
    </form>
  );
}
