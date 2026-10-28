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
   IF f ? 'condition' AND (NOT prior ? (f->'condition'->>'fieldId') OR prior->(f->'condition'->>'fieldId')->>'type'='File' OR COALESCE(f->'condition'->>'operator','') NOT IN ('Equals','NotEquals','Answered') OR COALESCE(length(f->'condition'->>'value'),0) NOT BETWEEN 1 AND 120) THEN RAISE EXCEPTION 'Invalid condition'; END IF;
   IF f ? 'condition' THEN
    IF jsonb_typeof(f->'condition'->'value') IS DISTINCT FROM 'string' OR EXISTS(SELECT 1 FROM jsonb_object_keys(f->'condition') k WHERE k NOT IN ('fieldId','operator','value')) OR (f->'condition'->>'operator'<>'Answered' AND prior->(f->'condition'->>'fieldId')->>'type'='Checkbox' AND f->'condition'->>'value' NOT IN ('true','false')) OR (f->'condition'->>'operator'<>'Answered' AND jsonb_array_length(prior->(f->'condition'->>'fieldId')->'options')>0 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(prior->(f->'condition'->>'fieldId')->'options') oo WHERE oo->>'value'=f->'condition'->>'value')) THEN RAISE EXCEPTION 'Invalid condition answer'; END IF;
   END IF;
   prior:=prior||jsonb_build_object(f->>'id',f);
  END LOOP;
 END LOOP;
END; $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION lub.validate_form_answers(d jsonb,input jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE f jsonb; v jsonb; c jsonb; output jsonb:='{}'; known text[]; visible boolean; equal boolean; empty boolean; n numeric; txt text;
BEGIN
 IF input IS NULL OR jsonb_typeof(input)<>'object' OR octet_length(input::text)>256000 THEN RAISE EXCEPTION 'Invalid answers'; END IF;
 SELECT array_agg(e.value->>'id') INTO known FROM jsonb_array_elements(d->'sections') s CROSS JOIN LATERAL jsonb_array_elements(s->'fields') e;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(input) k WHERE NOT k=ANY(known)) THEN RAISE EXCEPTION 'Unknown field'; END IF;
 FOR f IN SELECT e.value FROM jsonb_array_elements(d->'sections') s CROSS JOIN LATERAL jsonb_array_elements(s->'fields') e LOOP
  v:=input->(f->>'id'); c:=f->'condition'; visible:=true;
  IF c IS NOT NULL THEN
   IF c->>'operator'='Answered' OR (c->>'operator'='Equals' AND c->>'value'='true' AND EXISTS(SELECT 1 FROM jsonb_array_elements(d->'sections') s CROSS JOIN LATERAL jsonb_array_elements(s->'fields') e WHERE e->>'id'=c->>'fieldId' AND e->>'type'='Committee')) THEN
    visible:=output ? (c->>'fieldId');
   ELSE
    equal:=output->>(c->>'fieldId')=c->>'value' OR (jsonb_typeof(output->(c->>'fieldId'))='array' AND output->(c->>'fieldId') ? (c->>'value'));
    visible:=output ? (c->>'fieldId') AND COALESCE(CASE WHEN c->>'operator'='Equals' THEN equal ELSE NOT equal END,false);
   END IF;
  END IF;
  IF NOT visible THEN CONTINUE; END IF;
  empty:=v IS NULL OR v='null'::jsonb OR v='""'::jsonb OR v='[]'::jsonb OR (f->>'type'='Checkbox' AND (f->>'required')::boolean AND v<>'true'::jsonb);
  IF empty THEN IF (f->>'required')::boolean THEN RAISE EXCEPTION 'Required field'; END IF; CONTINUE; END IF;
  txt:=v#>>'{}';
  CASE f->>'type'
   WHEN 'Checkbox' THEN IF jsonb_typeof(v)<>'boolean' THEN RAISE EXCEPTION 'Invalid checkbox'; END IF;
   WHEN 'MultiSelect' THEN IF jsonb_typeof(v)<>'array' OR jsonb_array_length(v)>30 OR (SELECT count(*)<>count(DISTINCT value) FROM jsonb_array_elements(v)) OR EXISTS(SELECT 1 FROM jsonb_array_elements(v) a WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(f->'options') o WHERE o->'value'=a)) THEN RAISE EXCEPTION 'Invalid choice'; END IF;
   WHEN 'Select','Radio' THEN IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(f->'options') o WHERE o->'value'=v) THEN RAISE EXCEPTION 'Invalid choice'; END IF;
   WHEN 'Number' THEN IF txt !~ '^-?[0-9]+([.][0-9]+)?$' THEN RAISE EXCEPTION 'Invalid number'; END IF; n:=txt::numeric; IF (f ? 'min' AND n<(f->>'min')::numeric) OR (f ? 'max' AND n>(f->>'max')::numeric) THEN RAISE EXCEPTION 'Invalid bounds'; END IF; v:=to_jsonb(n);
   WHEN 'Committee' THEN IF jsonb_typeof(v)<>'string' OR txt !~ '^[0-9a-f-]{36}$' THEN RAISE EXCEPTION 'Invalid committee'; END IF; PERFORM txt::uuid;
   WHEN 'File' THEN IF NOT EXISTS(SELECT 1 FROM lub.application_assets a WHERE a.id=txt::uuid AND a.owner_user_id=auth.uid()) THEN RAISE EXCEPTION 'Invalid attachment'; END IF;
   ELSE
    IF jsonb_typeof(v)<>'string' OR length(trim(txt)) NOT BETWEEN 1 AND (f->>'maxLength')::int THEN RAISE EXCEPTION 'Invalid text'; END IF;
    IF f->>'type'='Email' AND (length(txt)>254 OR txt !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$') THEN RAISE EXCEPTION 'Invalid email'; END IF;
    IF f->>'type'='Date' AND (txt !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' OR to_char(txt::date,'YYYY-MM-DD')<>txt) THEN RAISE EXCEPTION 'Invalid date'; END IF;
    v:=to_jsonb(trim(txt));
  END CASE;
  output:=output||jsonb_build_object(f->>'id',v);
 END LOOP; RETURN output;
END; $$;
