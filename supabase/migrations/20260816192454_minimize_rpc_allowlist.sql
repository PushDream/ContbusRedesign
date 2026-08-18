-- Ticket-transfer RPCs are retained for a future workflow but are not called by
-- the current clients. Keep them out of the authenticated Data API allowlist.

revoke execute on function public.lookup_ticket_trip(text[]) from public, anon, authenticated;
revoke execute on function public.assess_ticket_for_trip(text[], uuid) from public, anon, authenticated;
revoke execute on function public.transfer_ticket_to_trip(text[], uuid) from public, anon, authenticated;
