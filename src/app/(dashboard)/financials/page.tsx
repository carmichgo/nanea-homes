import { createClient } from "@/lib/supabase/server";
import { Transaction, Property } from "@/types";
import { PortfolioFinancialsView } from "./portfolio-financials-view";

export default async function PortfolioFinancialsPage() {
  const supabase = await createClient();

  const [{ data: properties }, { data: transactions }] = await Promise.all([
    supabase
      .from("properties")
      .select("*")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("transactions")
      .select("*")
      .order("date", { ascending: false }),
  ]);

  return (
    <PortfolioFinancialsView
      properties={(properties as Property[]) ?? []}
      transactions={(transactions as Transaction[]) ?? []}
    />
  );
}
