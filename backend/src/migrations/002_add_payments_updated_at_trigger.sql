create or replace function set_payments_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_payments_set_updated_at on payments;

create trigger trg_payments_set_updated_at
before update on payments
for each row
execute function set_payments_updated_at();
