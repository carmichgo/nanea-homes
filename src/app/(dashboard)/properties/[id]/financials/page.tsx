import { createAdminClient } from "@/lib/supabase/admin";
import { Transaction, Property } from "@/types";

export const dynamic = "force-dynamic";

import { PropertyFinancialsView } from "./property-financials-view";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PropertyFinancialsPage({ params }: Props) {
  const { id } = await params;
  const supabase = createAdminClient();

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
