-- Preserve event IDs, dates and actors. Infer a return only from a recorded earlier ending.
update lub.membership_events joined set event_code='Rejoined'
where joined.imported and joined.event_code='Joined' and exists(
 select 1 from lub.membership_events ended where ended.membership_id=joined.membership_id
 and ended.source_membership_id<>joined.source_membership_id and ended.event_code='Ended'
 and ended.occurred_at<=joined.occurred_at
);
