import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";

const CATEGORIES = [
  "rent", "repair", "insurance", "mortgage", "utilities",
  "management_fee", "tax", "supplies", "cleaning",
  "advertising", "legal", "transfer", "other",
];

const TYPES = ["income", "expense", "internal"];

export async function POST(request: NextRequest) {
  try {
    const { id, description, merchant_name, amount, direction } = await request.json();

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

    const anthropic = new Anthropic({ apiKey });

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 256,
      messages: [
        {
          role: "user",
          content: `Categorize this rental property bank transaction.

Transaction:
- Description: "${description || ""}"
- Merchant: "${merchant_name || ""}"
- Amount: $${amount}
- Direction: ${direction} (${direction === "outgoing" ? "money left the account" : "money came into the account"})

CATEGORIES: ${CATEGORIES.join(", ")}
TYPES: income, expense, internal

Type rules:
- "income" = money received (rent from tenants, refunds, deposits received)
- "expense" = money spent (repairs, insurance, mortgage, utilities, fees)
- "internal" = ONLY for transfers between the owner's own bank accounts, not real income or expense

Respond with ONLY a JSON object, no markdown:
{"category": "category_name", "type": "income|expense|internal"}`,
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

    // Update the transaction
    const adminClient = createAdminClient();
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
