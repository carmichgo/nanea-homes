import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";

const CATEGORIES = [
  "rent", "repair", "insurance", "mortgage", "loan", "utilities",
  "management_fee", "tax", "supplies", "cleaning",
  "advertising", "legal", "return_payment", "transfer", "other",
];

function extractMerchant(description: string, merchantName: string | null): string {
  if (merchantName) return merchantName.toUpperCase().trim();
  const match = description.match(/Merchant name:\s*(.+?)(?:;|$)/i);
  if (match) return match[1].toUpperCase().trim();
  return description.toUpperCase().trim().substring(0, 50);
}

export async function POST(request: NextRequest) {
  try {
    const { id } = await request.json();

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
    }
    if (!id) {
      return NextResponse.json({ error: "Transaction id is required" }, { status: 400 });
    }

    const adminClient = createAdminClient();

    const { data: txn, error: txnError } = await adminClient
      .from("transactions")
      .select("*")
      .eq("id", id)
      .single();

    if (txnError || !txn) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    const thisMerchant = extractMerchant(txn.description || "", txn.merchant_name);

    // STEP 1: Check if there's a direct match from past categorizations
    const { data: allTxns } = await adminClient
      .from("transactions")
      .select("description, merchant_name, type, category")
      .eq("property_id", txn.property_id)
      .neq("id", id)
      .not("category", "is", null);

    if (allTxns && allTxns.length > 0) {
      // Build a map of merchant → most common category
      const merchantCounts = new Map<string, Map<string, number>>();

      for (const t of allTxns) {
        const m = extractMerchant(t.description || "", t.merchant_name);
        if (!merchantCounts.has(m)) merchantCounts.set(m, new Map());
        const catMap = merchantCounts.get(m)!;
        const key = `${t.category}`;
        catMap.set(key, (catMap.get(key) || 0) + 1);
      }

      // Direct match - same merchant already categorized
      const directMatch = merchantCounts.get(thisMerchant);
      if (directMatch && directMatch.size > 0) {
        let bestCat = "";
        let bestCount = 0;
        directMatch.forEach((count, cat) => {
          if (count > bestCount) {
            bestCat = cat;
            bestCount = count;
          }
        });

        if (bestCat && CATEGORIES.includes(bestCat)) {
          // Use the existing categorization directly - no AI needed
          await adminClient
            .from("transactions")
            .update({ category: bestCat })
            .eq("id", id);

          return NextResponse.json({ category: bestCat, type: txn.type, matched: thisMerchant });
        }
      }
    }

    // STEP 2: No direct match - use AI with learned patterns
    const learned: string[] = [];
    if (allTxns && allTxns.length > 0) {
      const patternMap = new Map<string, { category: string; count: number }>();

      for (const t of allTxns) {
        const m = extractMerchant(t.description || "", t.merchant_name);
        const existing = patternMap.get(m);
        if (!existing || t.category !== existing.category) {
          const key = m;
          if (!patternMap.has(key) || (patternMap.get(key)?.count || 0) < 1) {
            patternMap.set(key, { category: t.category, count: 1 });
          } else {
            patternMap.get(key)!.count++;
          }
        }
      }

      patternMap.forEach(({ category }, merchant) => {
        learned.push(`- "${merchant}" → category: "${category}"`);
      });
    }

    const examplesBlock = learned.length > 0
      ? `\nLEARNED PATTERNS (owner's past categorizations - FOLLOW these for matching merchants):\n${learned.slice(0, 30).join("\n")}\n\nIf the merchant matches any pattern above, use EXACTLY that category.\n`
      : "";

    const anthropic = new Anthropic({ apiKey });

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 256,
      messages: [
        {
          role: "user",
          content: `Categorize this rental property bank transaction. Pick the best category.

Transaction:
- Description: "${txn.description || "N/A"}"
- Merchant: "${txn.merchant_name || "N/A"}"
- Amount: $${txn.amount}
- Date: ${txn.date}
- Plaid subcategory: ${txn.subcategory || "N/A"}

CATEGORIES: ${CATEGORIES.join(", ")}

TYPE: Keep as "${txn.type}". Only change to "internal" if it's a transfer between own accounts or a returned/failed payment.
${examplesBlock}
Respond ONLY with JSON, no markdown:
{"category": "category_name", "type": "${txn.type}"}`,
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

    if (!CATEGORIES.includes(result.category)) {
      return NextResponse.json({ error: "Invalid AI response" }, { status: 500 });
    }

    // ENFORCE: AI can only keep the original type or change to "internal"
    let finalType = txn.type;
    if (result.type === "internal") {
      finalType = "internal";
    }

    await adminClient
      .from("transactions")
      .update({ category: result.category, type: finalType })
      .eq("id", id);

    return NextResponse.json({ category: result.category, type: finalType });
  } catch (error: any) {
    console.error("AI categorization error:", error);
    return NextResponse.json({ error: error?.message || "Failed to categorize" }, { status: 500 });
  }
}
