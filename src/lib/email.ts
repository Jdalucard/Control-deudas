import "server-only";
import nodemailer from "nodemailer";
import { dateEs } from "@/lib/format";
import { fmtCop, fmtMoney, type Currency } from "@/lib/finance";

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) throw new Error("Falta configurar GMAIL_USER o GMAIL_APP_PASSWORD");
  transporter ??= nodemailer.createTransport({ service: "gmail", auth: { user, pass } });
  return transporter;
}

async function sendEmail(input: {
  to: string[];
  subject: string;
  html: string;
  attachments?: { filename: string; content: string }[];
}): Promise<void> {
  await getTransporter().sendMail({
    from: process.env.GMAIL_USER,
    to: input.to,
    subject: input.subject,
    html: input.html,
    attachments: input.attachments?.map((a) => ({ filename: a.filename, content: a.content, encoding: "base64" })),
  });
}

function approveUrl(paymentId: string): string {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return `${site.replace(/\/$/, "")}/payments#pago-${paymentId}`;
}

const buttonStyle =
  "display:inline-block;margin-top:12px;padding:10px 18px;border-radius:8px;background:#0f766e;color:#ffffff;text-decoration:none;font-weight:600;";

export type ReceiptEmailInput = {
  to: string[];
  paymentId: string;
  debtName: string;
  amountCop: number;
  paidAt: string;
  note: string | null;
  debtBalance: number;
  debtCurrency: Currency;
  totalDebtCop: number;
  attachment: { filename: string; content: string; contentType: string };
};

/** Envía el correo con el recibo adjunto a los destinatarios configurados en la deuda. Lanza si Gmail rechaza el envío. */
export async function sendReceiptEmail(input: ReceiptEmailInput): Promise<void> {
  const { to } = input;

  const html = `
    <div style="font-family: sans-serif; font-size: 15px; color: #111;">
      <h2 style="margin: 0 0 12px;">Nuevo abono registrado</h2>
      <p>Se registró un abono a <strong>${input.debtName}</strong>.</p>
      <table cellpadding="6" style="border-collapse: collapse; margin: 12px 0;">
        <tr><td>Monto abonado</td><td><strong>${fmtCop(input.amountCop)}</strong></td></tr>
        <tr><td>Fecha del pago</td><td>${dateEs(input.paidAt)}</td></tr>
        <tr><td>Saldo restante de esta deuda</td><td>${fmtMoney(input.debtBalance, input.debtCurrency)}</td></tr>
        <tr><td>Deuda total general restante</td><td><strong>${fmtCop(input.totalDebtCop)}</strong></td></tr>
        ${input.note ? `<tr><td>Nota</td><td>${input.note}</td></tr>` : ""}
      </table>
      <p>El recibo adjunto es el comprobante de este pago.</p>
      <p>Si ya recibiste el dinero, confírmalo entrando a tu cuenta y aprobando el abono:</p>
      <a href="${approveUrl(input.paymentId)}" style="${buttonStyle}">Ver y aprobar el pago</a>
    </div>
  `;

  await sendEmail({
    to,
    subject: `Abono registrado: ${fmtCop(input.amountCop)} a ${input.debtName}`,
    html,
    attachments: [{ filename: input.attachment.filename, content: input.attachment.content }],
  });
}

export type ApprovalEmailInput = {
  to: string;
  approverEmail: string;
  debtName: string;
  amountCop: number;
  paidAt: string;
};

/** Avisa a quien registró el abono que la otra parte confirmó haberlo recibido. */
export async function sendApprovalEmail(input: ApprovalEmailInput): Promise<void> {
  const html = `
    <div style="font-family: sans-serif; font-size: 15px; color: #111;">
      <h2 style="margin: 0 0 12px;">Tu abono fue aprobado</h2>
      <p><strong>${input.approverEmail}</strong> confirmó que recibió el abono de <strong>${fmtCop(input.amountCop)}</strong> a <strong>${input.debtName}</strong> del ${dateEs(input.paidAt)}.</p>
    </div>
  `;
  await sendEmail({ to: [input.to], subject: `${input.approverEmail} aprobó tu abono de ${fmtCop(input.amountCop)}`, html });
}
