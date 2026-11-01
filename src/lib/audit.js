import { isSupabaseConfigured, supabase } from "./supabase.js";

export const AUDIT_ENTITIES = [
  "bookings",
  "trips",
  "contbus_fares",
  "contbus_departures",
  "contbus_stops",
  "vehicles",
  "profiles",
];

export async function fetchAuditLog({ page, pageSize, entity }) {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured for this deployment.");
  }

  const from = (page - 1) * pageSize;
  let query = supabase
    .from("audit_log")
    .select("id, occurred_at, actor_id, actor_role, entity, entity_id, action, changes, actor:profiles(full_name)", {
      count: "exact",
    })
    .order("occurred_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, from + pageSize - 1);

  if (entity !== "all") query = query.eq("entity", entity);

  const { data, error, count } = await query;
  if (error) throw error;
  return { entries: data || [], total: count || 0 };
}
