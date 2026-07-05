-- Phase 2a: realtime for the dashboard + single-owner RLS hardening
-- (applied to project bodmxdxwbqhbgxllggtz on 2026-07-05)

-- Let the dashboard subscribe to live changes (RLS still applies per subscriber).
alter publication supabase_realtime add table listings;
alter publication supabase_realtime add table applications;
alter publication supabase_realtime add table replies;
alter publication supabase_realtime add table source_runs;

-- Harden RLS: only the owner account may access data (was: any authenticated user).
-- Defense in depth for the public dashboard URL even if signups were enabled.
drop policy "authenticated full access" on listings;
drop policy "authenticated full access" on applications;
drop policy "authenticated full access" on replies;
drop policy "authenticated full access" on source_runs;
drop policy "authenticated full access" on push_subscriptions;

create policy "owner full access" on listings for all to authenticated
  using ((auth.jwt() ->> 'email') = 'imsounic@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'imsounic@gmail.com');
create policy "owner full access" on applications for all to authenticated
  using ((auth.jwt() ->> 'email') = 'imsounic@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'imsounic@gmail.com');
create policy "owner full access" on replies for all to authenticated
  using ((auth.jwt() ->> 'email') = 'imsounic@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'imsounic@gmail.com');
create policy "owner full access" on source_runs for all to authenticated
  using ((auth.jwt() ->> 'email') = 'imsounic@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'imsounic@gmail.com');
create policy "owner full access" on push_subscriptions for all to authenticated
  using ((auth.jwt() ->> 'email') = 'imsounic@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'imsounic@gmail.com');
