import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";
import { publishDataChanged } from "@/lib/realtime";

export async function POST() {
  await destroySession();
  void publishDataChanged("usuarios");
  return NextResponse.json({ ok: true });
}
