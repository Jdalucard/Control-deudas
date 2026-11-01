"use client";

import { useMemo, useState } from "react";
import { fmtCop, fmtMoney, fmtTrm } from "@/lib/finance";
import { dateEs, dateTimeEs } from "@/lib/format";
import type { Payment } from "@/lib/data";
import { approvePayment, deletePayment } from "./actions";

type DebtOption = { debt_id: string; name: string };
type StatusFilter = "todos" | "pendiente" | "aprobado";

function paymentsToCsv(payments: Payment[]): string {
  const header = ["Fecha", "Deuda", "Pagaste (COP)", "TRM", "Descuenta", "Nota", "Estado"];
  const rows = payments.map((p) => [
    dateEs(p.paid_at),
    p.debts?.name ?? "",
    String(p.amount_cop),
    p.trm_used ? String(p.trm_used) : "",
    p.debts ? String(p.applied_amount) : "",
    p.note ?? "",
    p.approved_at ? "Aprobado" : "Pendiente",
  ]);
  return [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
}

function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function PaymentsTable({
  payments,
  debtOptions,
  receiptUrls,
  userId,
}: {
  payments: Payment[];
  debtOptions: DebtOption[];
  receiptUrls: Record<string, string>;
  userId: string;
}) {
  const [debtFilter, setDebtFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");

  const filtered = useMemo(() => {
    return payments.filter((p) => {
      if (debtFilter && p.debt_id !== debtFilter) return false;
      if (statusFilter === "pendiente" && p.approved_at) return false;
      if (statusFilter === "aprobado" && !p.approved_at) return false;
      return true;
    });
  }, [payments, debtFilter, statusFilter]);

  const pendingCount = payments.filter((p) => !p.approved_at).length;
  const approvedCount = payments.length - pendingCount;

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="card">
          <p className="text-sm text-muted-foreground">Pendientes de aprobar</p>
          <p className="mt-1 text-2xl font-semibold">{pendingCount}</p>
        </div>
        <div className="card">
          <p className="text-sm text-muted-foreground">Aprobados</p>
          <p className="mt-1 text-2xl font-semibold">{approvedCount}</p>
        </div>
      </div>

      <div className="card flex flex-wrap items-end gap-3">
        <div>
          <label className="label" htmlFor="f-deuda">Deuda</label>
          <select id="f-deuda" className="input" value={debtFilter} onChange={(e) => setDebtFilter(e.target.value)}>
            <option value="">Todas</option>
            {debtOptions.map((d) => (
              <option key={d.debt_id} value={d.debt_id}>{d.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="f-estado">Estado</label>
          <select id="f-estado" className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}>
            <option value="todos">Todos</option>
            <option value="pendiente">Pendiente</option>
            <option value="aprobado">Aprobado</option>
          </select>
        </div>
        <button
          type="button"
          onClick={() => downloadCsv(paymentsToCsv(filtered), `abonos-${new Date().toISOString().slice(0, 10)}.csv`)}
          className="btn-ghost ml-auto"
          disabled={filtered.length === 0}
        >
          Exportar CSV
        </button>
      </div>

      {filtered.length === 0 ? (
        <p className="card text-sm text-muted-foreground">Ningún abono coincide con el filtro.</p>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-medium">Fecha</th>
                <th className="px-2 py-2 font-medium">Deuda</th>
                <th className="px-2 py-2 text-right font-medium">Pagaste</th>
                <th className="px-2 py-2 text-right font-medium">TRM</th>
                <th className="px-2 py-2 text-right font-medium">Descuenta</th>
                <th className="px-2 py-2 font-medium">Nota</th>
                <th className="px-2 py-2 font-medium">Recibo</th>
                <th className="px-2 py-2 font-medium">Estado</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const canApprove = !p.approved_at && p.created_by !== userId;
                return (
                  <tr key={p.id} id={`pago-${p.id}`} className="border-t border-border scroll-mt-20">
                    <td className="whitespace-nowrap px-4 py-2">{dateEs(p.paid_at)}</td>
                    <td className="px-2 py-2">{p.debts?.name ?? "—"}</td>
                    <td className="whitespace-nowrap px-2 py-2 text-right">{fmtCop(p.amount_cop)}</td>
                    <td className="px-2 py-2 text-right">{p.trm_used ? fmtTrm(p.trm_used) : "—"}</td>
                    <td className="whitespace-nowrap px-2 py-2 text-right">{p.debts ? fmtMoney(p.applied_amount, p.debts.currency) : "—"}</td>
                    <td className="max-w-48 truncate px-2 py-2 text-muted-foreground">{p.note}</td>
                    <td className="px-2 py-2">
                      {p.receipt_path && receiptUrls[p.receipt_path] ? (
                        <a href={receiptUrls[p.receipt_path]} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                          Ver
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2">
                      {p.approved_at ? (
                        <span className="text-xs text-muted-foreground" title={`Aprobado por ${p.approved_by_email ?? "—"}`}>
                          Aprobado · {dateTimeEs(p.approved_at)}
                        </span>
                      ) : canApprove ? (
                        <form action={approvePayment}>
                          <input type="hidden" name="id" value={p.id} />
                          <button className="btn-ghost text-xs">Aprobar</button>
                        </form>
                      ) : (
                        <span className="text-xs text-muted-foreground">Pendiente</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {!p.approved_at && (
                        <form action={deletePayment}>
                          <input type="hidden" name="id" value={p.id} />
                          <button className="text-xs text-danger hover:underline" aria-label={`Eliminar abono del ${dateEs(p.paid_at)}`}>Eliminar</button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
