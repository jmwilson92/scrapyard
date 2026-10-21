import { NextResponse } from "next/server";
import { isSafeId } from "@/lib/paths";
import { findCompanyOwnerId } from "@/lib/repo";
import { getRequestDb } from "@/lib/server-db";

/** Stable company URL; profiles render at /shops/[ownerId] for now. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isSafeId(id)) return new NextResponse("Not found", { status: 404 });
  const db = await getRequestDb();
  const owner = await findCompanyOwnerId(db, id);
  if (!owner) return new NextResponse("Not found", { status: 404 });
  return NextResponse.redirect(new URL(`/shops/${owner}`, request.url));
}
