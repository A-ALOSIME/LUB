-- Presence conditions can depend on any earlier question, including uploaded files.
-- Support explicit answered conditions and legacy Committee Equals/true rules without rewriting published versions.
CREATE OR REPLACE FUNCTION lub.validate_form_definition(d jsonb) RETURNS void LANGUAGE plpgsql SET search_path='' AS $$
DECLARE s jsonb; f jsonb; o jsonb; prior jsonb:='{}'; ids text[]:='{}'; total int:=0;
BEGIN
 IF d IS NULL OR jsonb_typeof(d)<>'object' OR octet_length(d::text)>128000 OR COALESCE(d->>'layout','') NOT IN ('SinglePage','Progressive') OR jsonb_typeof(d->'sections') IS DISTINCT FROM 'array' OR jsonb_array_length(d->'sections') NOT BETWEEN 1 AND 12 THEN RAISE EXCEPTION 'Invalid definition'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(d) k WHERE k NOT IN ('layout','sections')) THEN RAISE EXCEPTION 'Invalid definition shape'; END IF;
 FOR s IN SELECT value FROM jsonb_array_elements(d->'sections') LOOP
  PERFORM (s->>'id')::uuid;
  IF s->>'id' !~ '^[0-9a-f-]{36}$' OR EXISTS(SELECT 1 FROM jsonb_object_keys(s) k WHERE k NOT IN ('id','title','description','fields')) OR jsonb_typeof(s->'description') IS DISTINCT FROM 'string' OR jsonb_typeof(s->'title') IS DISTINCT FROM 'string' OR jsonb_typeof(s->'id') IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'Invalid section shape'; END IF;
  IF s->>'id' IS NULL OR s->>'id'=ANY(ids) OR COALESCE(length(trim(s->>'title')),0) NOT BETWEEN 1 AND 120 OR length(s->>'description')>1000 OR jsonb_typeof(s->'fields') IS DISTINCT FROM 'array' OR jsonb_array_length(s->'fields') NOT BETWEEN 1 AND 30 THEN RAISE EXCEPTION 'Invalid section'; END IF;
  ids:=array_append(ids,s->>'id');
  FOR f IN SELECT value FROM jsonb_array_elements(s->'fields') LOOP
   PERFORM (f->>'id')::uuid; total:=total+1;
   IF f->>'id' !~ '^[0-9a-f-]{36}$' OR EXISTS(SELECT 1 FROM jsonb_object_keys(f) k WHERE k NOT IN ('id','type','label','help','required','options','maxLength','min','max','condition')) OR jsonb_typeof(f->'help') IS DISTINCT FROM 'string' OR jsonb_typeof(f->'label') IS DISTINCT FROM 'string' OR jsonb_typeof(f->'id') IS DISTINCT FROM 'string' OR jsonb_typeof(f->'maxLength') IS DISTINCT FROM 'number' OR (f ? 'min' AND jsonb_typeof(f->'min')<>'number') OR (f ? 'max' AND jsonb_typeof(f->'max')<>'number') THEN RAISE EXCEPTION 'Invalid field shape'; END IF;
   IF f->>'id' IS NULL OR f->>'id'=ANY(ids) OR total>60 OR COALESCE(f->>'type','') NOT IN ('ShortText','LongText','Number','Email','Date','Select','Radio','MultiSelect','Checkbox','File','Committee') OR COALESCE(length(trim(f->>'label')),0) NOT BETWEEN 1 AND 300 OR length(f->>'help')>1000 OR jsonb_typeof(f->'required') IS DISTINCT FROM 'boolean' OR COALESCE((f->>'maxLength')::int,0) NOT BETWEEN 1 AND 2000 OR jsonb_typeof(f->'options') IS DISTINCT FROM 'array' OR jsonb_array_length(f->'options')>30 THEN RAISE EXCEPTION 'Invalid field'; END IF;
   ids:=array_append(ids,f->>'id');
   IF (f->>'type' IN ('Select','Radio','MultiSelect') AND jsonb_array_length(f->'options')<2) OR (f->>'type' NOT IN ('Select','Radio','MultiSelect') AND jsonb_array_length(f->'options')<>0) OR (SELECT count(*)<>count(DISTINCT value->>'value') FROM jsonb_array_elements(f->'options')) THEN RAISE EXCEPTION 'Invalid choices'; END IF;
   FOR o IN SELECT value FROM jsonb_array_elements(f->'options') LOOP IF jsonb_typeof(o->'value') IS DISTINCT FROM 'string' OR jsonb_typeof(o->'label') IS DISTINCT FROM 'string' OR EXISTS(SELECT 1 FROM jsonb_object_keys(o) k WHERE k NOT IN ('value','label')) OR COALESCE(o->>'value','') !~ '^[a-zA-Z0-9_-]{1,40}$' OR COALESCE(length(trim(o->>'label')),0) NOT BETWEEN 1 AND 120 THEN RAISE EXCEPTION 'Invalid option'; END IF; END LOOP;
   IF f ? 'min' AND f ? 'max' AND (f->>'min')::numeric>(f->>'max')::numeric THEN RAISE EXCEPTION 'Invalid bounds'; END IF;
   IF f ? 'condition' AND (NOT prior ? (f->'condition'->>'fieldId') OR (prior->(f->'condition'->>'fieldId')->>'type'='File' AND f->'condition'->>'operator' NOT IN ('Answered','NotAnswered')) OR COALESCE(f->'condition'->>'operator','') NOT IN ('Equals','NotEquals','Answered','NotAnswered') OR COALESCE(length(f->'condition'->>'value'),0) NOT BETWEEN 1 AND 120) THEN RAISE EXCEPTION 'Invalid condition'; END IF;
   IF f ? 'condition' THEN
    IF jsonb_typeof(f->'condition'->'value') IS DISTINCT FROM 'string' OR EXISTS(SELECT 1 FROM jsonb_object_keys(f->'condition') k WHERE k NOT IN ('fieldId','operator','value')) OR (f->'condition'->>'operator' NOT IN ('Answered','NotAnswered') AND prior->(f->'condition'->>'fieldId')->>'type'='Checkbox' AND f->'condition'->>'value' NOT IN ('true','false')) OR (f->'condition'->>'operator' NOT IN ('Answered','NotAnswered') AND jsonb_array_length(prior->(f->'condition'->>'fieldId')->'options')>0 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(prior->(f->'condition'->>'fieldId')->'options') oo WHERE oo->>'value'=f->'condition'->>'value')) THEN RAISE EXCEPTION 'Invalid condition answer'; END IF;
   END IF;
   prior:=prior||jsonb_build_object(f->>'id',f);
  END LOOP;
 END LOOP;
END; $$;
