import { createClient } from "@/lib/supabase/server";
import { Transaction, Property } from "@/types";
import { PropertyFinancialsView } from "./property-financials-view";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PropertyFinancialsPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: property }, { data: transactions }] = await Promise.all([
    supabase
      .from("properties")
      .select("*")
      .eq("id", id)
      .single(),
    supabase
      .from("transactions")
      .select("*")
      .eq("property_id", id)
      .order("date", { ascending: false }),
  ]);

  return (
    <PropertyFinancialsView
      property={(property as Property) ?? null}
      transactions={(transactions as Transaction[]) ?? []}
    />
  );
}
