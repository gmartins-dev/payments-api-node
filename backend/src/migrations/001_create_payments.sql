create extension if not exists pgcrypto;

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'payment_status'
  ) then
    create type payment_status as enum ('PENDING', 'SUCCESS', 'FAILED');
  end if;
end
$$;

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  amount numeric(12,2) not null check (amount > 0),
  customer_id text not null,
  status payment_status not null,
  response_status_code int,
  response_body jsonb,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_payments_status on payments (status);
create index if not exists idx_payments_customer_id on payments (customer_id);
