import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";

const CATEGORIES = [
  "rent", "repair", "insurance", "mortgage", "loan", "utilities",
  "management_fee", "tax", "supplies", "cleaning",
  "advertising", "legal", "return_payment", "transfer", "other",
];

const TYPES = ["income", "expense", "internal"];

export async function POST(request: NextRequest) {
  try {
    const { id } = await request.json();

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY not configured" },
        { status: 500 }
      );
    }

    if (!id) {
      return NextResponse.json(
        { error: "Transaction id is required" },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    // Fetch the full transaction with all Plaid data
    const { data: txn, error: txnError } = await adminClient
      .from("transactions")
      .select("*")
      .eq("id", id)
      .single();

    if (txnError || !txn) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    // Fetch ALL categorized transactions from this property as examples
    // This includes ones the user manually corrected via the edit button
    const { data: examples } = await adminClient
      .from("transactions")
      .select("description, merchant_name, amount, type, category, status")
      .eq("property_id", txn.property_id)
      .neq("id", id)
      .not("category", "is", null)
      .order("date", { ascending: false })
      .limit(100);

    let examplesBlock = "";
    if (examples && examples.length > 0) {
      // Group by merchant/description pattern to find the MOST COMMON category for each
      const patternMap = new Map<string, { type: string; category: string; count: number }[]>();

      for (const e of examples) {
        const desc = (e.description || "").toUpperCase().trim();
        const merchant = (e.merchant_name || "").toUpperCase().trim();
        const key = merchant || desc.substring(0, 40);
        if (!key) continue;

        const existing = patternMap.get(key) || [];
        const match = existing.find((x) => x.category === e.category && x.type === e.type);
        if (match) {
          match.count++;
        } else {
          existing.push({ type: e.type, category: e.category, count: 1 });
        }
        patternMap.set(key, existing);
      }

      // For each pattern, pick the most common categorization
      const learned: string[] = [];
      patternMap.forEach((cats, key) => {
        const best = cats.sort((a, b) => b.count - a.count)[0];
        learned.push(`- "${key}" → type: "${best.type}", category: "${best.category}" (seen ${best.count}x)`);
      });

      if (learned.length > 0) {
        examplesBlock = `
LEARNED PATTERNS FROM THIS PROPERTY (the owner has categorized these before - follow the same pattern):
${learned.slice(0, 25).join("\n")}

IMPORTANT: If the transaction description or merchant matches any pattern above, use the SAME category and type. The owner's past categorizations take priority over your guesses.
`;
      }
    }

    const anthropic = new Anthropic({ apiKey });

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 256,
      messages: [
        {
          role: "user",
          content: `You are an expert accountant categorizing bank transactions for a RENTAL PROPERTY business. This is a bank account used exclusively for a rental property.

Transaction details:
- Description: "${txn.description || "N/A"}"
- Merchant: "${txn.merchant_name || "N/A"}"
- Amount: $${txn.amount}
- Date: ${txn.date}
- Current type: ${txn.type} (may be wrong)
- Current category: ${txn.category || "uncategorized"} (may be wrong)
- Plaid subcategory: ${txn.subcategory || "N/A"}
- Status: ${txn.status}

CONTEXT: This bank account is for a rental property. Common transactions include:
- Tenant rent payments (incoming deposits, often recurring monthly, Zelle, ACH, or direct deposit)
- Mortgage payments to the bank/lender
- Loan payments
- Insurance premiums (homeowner's, landlord, liability)
- Utility payments (electric, water, gas, sewer, trash, internet)
- Repair/maintenance costs (plumbers, electricians, handymen, contractors)
- Property management fees
- Property tax payments
- Cleaning services
- Legal fees
- Supplies (hardware store, Home Depot, Lowes, Amazon)
- Advertising costs (listing fees, marketing)
- Transfers between owner's own accounts (NOT income or expense)
- Returned/failed payments (NSF, chargebacks, reversals)

CATEGORIES (pick exactly one): ${CATEGORIES.join(", ")}

TYPES (pick exactly one):
- "income" = money RECEIVED into this account (tenant rent, refunds, security deposits received)
- "expense" = money PAID OUT from this account (mortgage, repairs, insurance, utilities, any bill payment)
- "internal" = ONLY money moving between the owner's own bank accounts (account transfers, NOT payments to/from others)

IMPORTANT RULES:
1. If description contains "RETURNED", "NSF", "REVERSAL", "FAILED", "DISHONORED" → type: "internal", category: "return_payment"
2. Recurring monthly incoming deposits are likely tenant rent → type: "income", category: "rent"
3. Payments to mortgage companies, loan servicers → type: "expense", category: "mortgage" or "loan"
4. ACH debits to insurance companies → type: "expense", category: "insurance"
5. Payments to utility companies → type: "expense", category: "utilities"
6. Hardware stores, contractor payments → type: "expense", category: "repair" or "supplies"
7. Transfers labeled "transfer", "xfer" between own accounts → type: "internal", category: "transfer"
8. When in doubt about income vs expense: if money came IN, it's income; if money went OUT, it's expense

${examplesBlock}
Respond with ONLY a JSON object, no explanation, no markdown:
{"category": "one_of_the_categories", "type": "income_or_expense_or_internal"}`,
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== "text") {
      return NextResponse.json({ error: "No response from AI" }, { status: 500 });
    }

    let jsonStr = content.text.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    }

    const result = JSON.parse(jsonStr) as { category: string; type: string };

    if (!CATEGORIES.includes(result.category) || !TYPES.includes(result.type)) {
      return NextResponse.json({ error: "Invalid AI response" }, { status: 500 });
    }

    await adminClient
      .from("transactions")
      .update({ category: result.category, type: result.type })
      .eq("id", id);

    return NextResponse.json({
      category: result.category,
      type: result.type,
    });
  } catch (error: any) {
    console.error("AI categorization error:", error);
    const msg = error?.message || "Failed to categorize";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
