// Los avisos viajan por la URL como códigos fijos (nunca como texto libre).
const MESSAGES: Record<string, { kind: "error" | "ok"; text: string }> = {
  credenciales: { kind: "error", text: "Correo o contraseña incorrectos." },
  campos: { kind: "error", text: "Completa todos los campos." },
  password_corta: { kind: "error", text: "La contraseña debe tener al menos 8 caracteres." },
  confirma_correo: { kind: "ok", text: "Cuenta creada. Revisa tu correo para confirmarla y luego entra." },
  recuperar_enviado: { kind: "ok", text: "Si ese correo tiene una cuenta, te enviamos un link para poner una contraseña nueva." },
  monto_invalido: { kind: "error", text: "El monto no es válido." },
  trm_requerida: { kind: "error", text: "Escribe la TRM de ese día (es obligatoria para deudas en USD)." },
  deuda_no_encontrada: { kind: "error", text: "No se encontró esa deuda." },
  codigo_invalido: { kind: "error", text: "Código de invitación inválido." },
  ya_hogar: { kind: "error", text: "Ya perteneces a un hogar." },
  abono_ok: { kind: "ok", text: "Abono registrado." },
  abono_ok_recibo: { kind: "ok", text: "Abono registrado. Se envió un correo con el recibo, el monto abonado y la deuda total." },
  abono_ok_recibo_error: { kind: "error", text: "El abono se guardó, pero no se pudo subir el recibo. Inténtalo de nuevo." },
  abono_ok_correo_error: { kind: "error", text: "El abono y el recibo se guardaron, pero no se pudo enviar el correo." },
  abono_aprobado_no_editable: { kind: "error", text: "Ese abono ya fue aprobado por la otra parte y no se puede borrar." },
  no_autoaprobar: { kind: "error", text: "No puedes aprobar un abono que tú mismo registraste." },
  pago_aprobado: { kind: "ok", text: "Pago aprobado. Se avisó por correo a quien lo registró." },
  pago_aprobado_sin_aviso: { kind: "error", text: "Pago aprobado, pero no se pudo avisar por correo a quien lo registró." },
  abono_borrado: { kind: "ok", text: "Abono eliminado." },
  deuda_ok: { kind: "ok", text: "Deuda guardada." },
  cuenta_ok: { kind: "ok", text: "Cuenta guardada." },
  movimiento_ok: { kind: "ok", text: "Movimiento registrado." },
  movimiento_borrado: { kind: "ok", text: "Movimiento eliminado." },
  generico: { kind: "error", text: "Algo salió mal. Inténtalo de nuevo." },
};

export function flash(code: string | undefined) {
  return code ? (MESSAGES[code] ?? null) : null;
}
