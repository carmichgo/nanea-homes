import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ALLOWED_TABLES = [
  "properties",
  "transactions",
  "contractors",
  "documents",
  "maintenance_records",
  "plaid_connections",
];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ table: string }> }
) {
  const { table } = await params;
  if (!ALLOWED_TABLES.includes(table)) {
    return NextResponse.json({ error: "Invalid table" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const url = request.nextUrl;
  const select = url.searchParams.get("select") || "*";
  const orderBy = url.searchParams.get("order");
  const limit = url.searchParams.get("limit");

  let query = supabase.from(table).select(select);

  // Apply filters from query params (field=value or field=op.value)
  url.searchParams.forEach((value, key) => {
    if (["select", "order", "limit", "single"].includes(key)) return;
    if (key.endsWith(".gte")) {
      query = query.gte(key.replace(".gte", ""), value);
    } else if (key.endsWith(".lte")) {
      query = query.lte(key.replace(".lte", ""), value);
    } else if (key.endsWith(".in")) {
      query = query.in(key.replace(".in", ""), value.split(","));
    } else if (key.endsWith(".neq")) {
      query = query.neq(key.replace(".neq", ""), value);
    } else {
      query = query.eq(key, value);
    }
  });

  if (orderBy) {
    const desc = orderBy.startsWith("-");
    const col = desc ? orderBy.slice(1) : orderBy;
    query = query.order(col, { ascending: !desc });
  }

  if (limit) {
    query = query.limit(parseInt(limit));
  }

  if (url.searchParams.get("single") === "true") {
    const { data, error } = await query.maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ table: string }> }
) {
  const { table } = await params;
  if (!ALLOWED_TABLES.includes(table)) {
    return NextResponse.json({ error: "Invalid table" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const body = await request.json();
  const { data, error } = await supabase.from(table).insert(body).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ table: string }> }
) {
  const { table } = await params;
  if (!ALLOWED_TABLES.includes(table)) {
    return NextResponse.json({ error: "Invalid table" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { id, ...updates } = await request.json();
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const { data, error } = await supabase
    .from(table)
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ table: string }> }
) {
  const { table } = await params;
  if (!ALLOWED_TABLES.includes(table)) {
    return NextResponse.json({ error: "Invalid table" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { id, ids } = await request.json();

  if (ids && Array.isArray(ids) && ids.length > 0) {
    const { error } = await supabase.from(table).delete().in("id", ids);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, deleted: ids.length });
  }

  if (!id) return NextResponse.json({ error: "id or ids required" }, { status: 400 });

  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
