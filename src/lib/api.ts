// Client-side database helper that routes through API instead of direct Supabase access

type FilterParams = Record<string, string | number | boolean>;

interface QueryOptions {
  select?: string;
  order?: string;
  limit?: number;
  single?: boolean;
  filters?: FilterParams;
}

export const db = {
  async query(table: string, options: QueryOptions = {}) {
    const params = new URLSearchParams();
    if (options.select) params.set("select", options.select);
    if (options.order) params.set("order", options.order);
    if (options.limit) params.set("limit", options.limit.toString());
    if (options.single) params.set("single", "true");
    if (options.filters) {
      Object.entries(options.filters).forEach(([key, value]) => {
        params.set(key, String(value));
      });
    }

    const res = await fetch(`/api/db/${table}?${params.toString()}`);
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Query failed");
    }
    return res.json();
  },

  async insert(table: string, data: Record<string, unknown>) {
    const res = await fetch(`/api/db/${table}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Insert failed");
    }
    return res.json();
  },

  async update(table: string, id: string, data: Record<string, unknown>) {
    const res = await fetch(`/api/db/${table}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...data }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Update failed");
    }
    return res.json();
  },

  async remove(table: string, id: string) {
    const res = await fetch(`/api/db/${table}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Delete failed");
    }
    return res.json();
  },
};
