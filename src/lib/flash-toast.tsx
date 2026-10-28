"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { flash } from "./messages";

/** Muestra el mensaje del código `?m=...` como notificación flotante (una sola vez por código). */
export function Flash({ code }: { code: string | undefined }) {
  useEffect(() => {
    const m = flash(code);
    if (!m) return;
    if (m.kind === "error") toast.error(m.text);
    else toast.success(m.text);
  }, [code]);

  return null;
}
