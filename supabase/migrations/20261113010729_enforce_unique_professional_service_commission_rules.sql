-- Evita regras duplicadas ativas para o mesmo profissional e serviço.
create unique index if not exists commission_rules_active_professional_service_unique
on public.commission_rules(org_id,professional_id,service_id)
where item_type='service' and active=true and professional_id is not null and service_id is not null;
