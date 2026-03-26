import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

const CATEGORIES = [
  "rent",
  "repair",
  "insurance",
  "mortgage",
  "utilities",
  "management_fee",
  "tax",
  "supplies",
  "cleaning",
  "advertising",
  "legal",
  "transfer",
  "other",
];

const TYPES = ["income", "expense", "internal"];

export async function POST(request: NextRequest) {
  try {
    const { transaction_ids, property_id } = await request.json();

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY not configured" },
        { status: 500 }
      );
    }

    const adminClient = createAdminClient();
    const anthropic = new Anthropic({ apiKey });

    // Fetch transactions to categorize
    let query = adminClient.from("transactions").select("*");

    if (transaction_ids && transaction_ids.length > 0) {
      query = query.in("id", transaction_ids);
    } else if (property_id) {
      query = query.eq("property_id", property_id);
    } else {
      return NextResponse.json(
        { error: "Provide transaction_ids or property_id" },
        { status: 400 }
      );
    }

    const { data: transactions, error: fetchError } = await query;

    if (fetchError || !transactions || transactions.length === 0) {
      return NextResponse.json(
        { error: "No transactions found" },
        { status: 404 }
      );
    }

    // Process in batches of 50
    const batchSize = 50;
    let totalUpdated = 0;

    for (let i = 0; i < transactions.length; i += batchSize) {
      const batch = transactions.slice(i, i + batchSize);

      const transactionList = batch
        .map(
          (t: any) =>
            `ID: ${t.id} | Date: ${t.date} | Amount: $${t.amount} | Description: "${t.description || ""}" | Merchant: "${t.merchant_name || ""}" | Current Category: "${t.category || "uncategorized"}" | Current Type: "${t.type}"`
        )
        .join("\n");

      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-6-20250514",
        max_tokens: 4096,
        messages: [
          {
            role: "user",
            content: `You are categorizing bank transactions for a rental property management system.

For each transaction, determine the best category and type.

CATEGORIES: ${CATEGORIES.join(", ")}
TYPES: income (money received like rent payments, refunds), expense (money spent like repairs, insurance, utilities), internal (inter-account transfers, bank fees, ATM withdrawals that don't affect P&L)

Rules:
- Rent payments from tenants = income, category "rent"
- Mortgage/loan payments = expense, category "mortgage"
- Insurance premiums = expense, category "insurance"
- Utility bills = expense, category "utilities"
- Repairs, maintenance, handyman = expense, category "repair"
- Property management fees = expense, category "management_fee"
- Property taxes = expense, category "tax"
- Transfers between accounts, Zelle transfers to self, ACH transfers = internal, category "transfer"
- Bank fees = internal, category "transfer"
- Cleaning services = expense, category "cleaning"
- Legal fees = expense, category "legal"
- Supplies, hardware store = expense, category "supplies"

TRANSACTIONS:
${transactionList}

Respond with ONLY a JSON array, no markdown, no explanation:
[{"id": "uuid", "category": "category_name", "type": "income|expense|internal"}, ...]`,
          },
        ],
      });

      const content = message.content[0];
      if (content.type !== "text") continue;

      try {
        // Extract JSON from response (handle possible markdown wrapping)
        let jsonStr = content.text.trim();
        if (jsonStr.startsWith("```")) {
          jsonStr = jsonStr.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
        }

        const results = JSON.parse(jsonStr) as Array<{
          id: string;
          category: string;
          type: string;
        }>;

        // Update each transaction
        for (const result of results) {
          if (
            CATEGORIES.includes(result.category) &&
            TYPES.includes(result.type)
          ) {
            await adminClient
              .from("transactions")
              .update({
                category: result.category,
                type: result.type,
              })
              .eq("id", result.id);
            totalUpdated++;
          }
        }
      } catch (parseError) {
        console.error("Failed to parse AI response:", parseError);
      }
    }

    return NextResponse.json({
      updated: totalUpdated,
      total: transactions.length,
    });
  } catch (error) {
    console.error("AI categorization error:", error);
    return NextResponse.json(
      { error: "Failed to categorize transactions" },
      { status: 500 }
    );
  }
}
