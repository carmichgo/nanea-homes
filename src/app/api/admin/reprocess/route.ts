import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const FAILED_KEYWORDS = [
  "RETURNED",
  "RETURN ITEM",
  "NSF",
  "REVERSAL",
  "FAILED",
  "DISHONORED",
  "RETURNED ITEM",
  "RETURN CHECK",
  "RETURNED CHECK",
  "INSUFFICIENT FUNDS",
  "CHARGEBACK",
];

export async function POST() {
  const adminClient = createAdminClient();

  // Fetch all transactions
  const { data: transactions, error } = await adminClient
    .from("transactions")
    .select("id, description, merchant_name, status, type, category");

  if (error || !transactions) {
    return NextResponse.json({ error: "Failed to fetch transactions" }, { status: 500 });
  }

  let updated = 0;

  for (const txn of transactions) {
    const name = (txn.description || "").toUpperCase();
    const merchant = (txn.merchant_name || "").toUpperCase();
    const combined = `${name} ${merchant}`;

    const isFailed = FAILED_KEYWORDS.some((kw) => combined.includes(kw));

    if (isFailed && txn.status !== "failed") {
      await adminClient
        .from("transactions")
        .update({
          status: "failed",
          type: "internal",
          category: "return_payment",
        })
        .eq("id", txn.id);
      updated++;
    }
  }

  return NextResponse.json({
    total: transactions.length,
    updated,
    message: `Marked ${updated} transactions as failed`,
  });
}
