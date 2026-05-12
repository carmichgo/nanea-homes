import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { plaidClient } from "@/lib/plaid/client";

export const maxDuration = 300;

function mapPlaidCategory(plaidCategory: string): string {
  const map: Record<string, string> = {
    INCOME: "rent",
    RENT: "rent",
    TRANSFER_IN: "transfer",
    TRANSFER_OUT: "transfer",
    BANK_FEES: "other",
    LOAN_PAYMENTS: "mortgage",
    FOOD_AND_DRINK: "other",
    GENERAL_MERCHANDISE: "supplies",
    HOME_IMPROVEMENT: "repair",
    GENERAL_SERVICES: "other",
    GOVERNMENT_AND_NON_PROFIT: "tax",
    TRANSPORTATION: "other",
    TRAVEL: "other",
    ENTERTAINMENT: "other",
    PERSONAL_CARE: "other",
    MEDICAL: "other",
    UTILITIES: "utilities",
    INSURANCE: "insurance",
    TAX: "tax",
  };
  return map[plaidCategory] || "other";
}

export async function GET(request: NextRequest) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminClient = createAdminClient();

  // Get all plaid connections
  const { data: connections, error } = await adminClient
    .from("plaid_connections")
    .select("*");

  if (error || !connections || connections.length === 0) {
    return NextResponse.json({ message: "No connections to sync", synced: 0 });
  }

  const results = [];

  for (const connection of connections) {
    try {
      let cursor = connection.cursor || undefined;
      let added = 0;
      let modified = 0;
      let removed = 0;
      let hasMore = true;

      while (hasMore) {
        const response = await plaidClient.transactionsSync({
          access_token: connection.plaid_access_token,
          cursor,
          count: 500,
        });

        const data = response.data;

        const transactionsToUpsert = [
          ...data.added,
          ...data.modified,
        ].map((txn) => {
          let type: string;
          const primaryCategory =
            txn.personal_finance_category?.primary || "";
          if (
            primaryCategory.startsWith("TRANSFER") ||
            primaryCategory === "BANK_FEES"
          ) {
            type = "internal";
          } else if (txn.amount > 0) {
            type = "expense";
          } else {
            type = "income";
          }
          return {
            property_id: connection.property_id,
            plaid_transaction_id: txn.transaction_id,
            type,
            status: txn.pending ? "pending" : "posted",
            amount: Math.abs(txn.amount),
            category: mapPlaidCategory(primaryCategory),
            subcategory:
              txn.personal_finance_category?.detailed || null,
            description: txn.name,
            merchant_name: txn.merchant_name || null,
            date: txn.date,
            is_manual: false,
          };
        });

        if (transactionsToUpsert.length > 0) {
          await adminClient
            .from("transactions")
            .upsert(transactionsToUpsert, {
              onConflict: "plaid_transaction_id",
            });
        }

        if (data.removed.length > 0) {
          const removedIds = data.removed.map((txn) => txn.transaction_id);
          await adminClient
            .from("transactions")
            .delete()
            .in("plaid_transaction_id", removedIds);
        }

        added += data.added.length;
        modified += data.modified.length;
        removed += data.removed.length;
        cursor = data.next_cursor;
        hasMore = data.has_more;
      }

      await adminClient
        .from("plaid_connections")
        .update({
          cursor,
          last_synced_at: new Date().toISOString(),
        })
        .eq("id", connection.id);

      results.push({
        property_id: connection.property_id,
        institution: connection.institution_name,
        added,
        modified,
        removed,
      });
    } catch (err: any) {
      results.push({
        property_id: connection.property_id,
        institution: connection.institution_name,
        error: err?.message || "Sync failed",
      });
    }
  }

  return NextResponse.json({
    synced: results.length,
    results,
    timestamp: new Date().toISOString(),
  });
}
