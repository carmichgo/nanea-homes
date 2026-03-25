import { createAdminClient } from "@/lib/supabase/admin";
import { Transaction, Property } from "@/types";
import { PortfolioFinancialsView } from "./portfolio-financials-view";

export default async function PortfolioFinancialsPage() {
  const supabase = createAdminClient();

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
