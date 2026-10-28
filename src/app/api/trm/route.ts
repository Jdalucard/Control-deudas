import { NextResponse } from "next/server";
import { fetchTrm } from "@/lib/trm";

export async function GET() {
  try {
    const quote = await fetchTrm();
    return NextResponse.json(quote, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } });
  } catch {
    return NextResponse.json({ error: "No se pudo obtener la TRM" }, { status: 502 });
  }
}
