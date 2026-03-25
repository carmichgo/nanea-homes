import { createClient } from "@/lib/supabase/server";
import { Transaction, Property } from "@/types";
import { PropertyFinancialsView } from "./property-financials-view";

interface Props {
  params: { id: string };
}

export default async function PropertyFinancialsPage({ params }: Props) {
  const supabase = createClient();

  const [{ data: property }, { data: transactions }] = await Promise.all([
    supabase
      .from("properties")
      .select("*")
      .eq("id", params.id)
      .single(),
    supabase
      .from("transactions")
      .select("*")
      .eq("property_id", params.id)
      .order("date", { ascending: false }),
  ]);

  return (
    <PropertyFinancialsView
      property={(property as Property) ?? null}
      transactions={(transactions as Transaction[]) ?? []}
    />
  );
}
