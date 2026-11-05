-- Campaigns are independent records. A closed/archived campaign must not reserve
-- an organization's academic term forever; responses remain pinned to its ID.
ALTER TABLE lub.renewal_campaigns DROP CONSTRAINT renewal_org_term_unique;
CREATE INDEX renewal_org_term_idx ON lub.renewal_campaigns(organization_id,academic_term_id);
