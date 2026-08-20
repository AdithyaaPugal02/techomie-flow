CREATE OR REPLACE FUNCTION public.techomie_exec(query_text text, query_params jsonb DEFAULT '[]'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  rendered text := regexp_replace(query_text, ';\s*$', '');
  result jsonb := '[]'::jsonb;
  parameter_count integer := jsonb_array_length(COALESCE(query_params, '[]'::jsonb));
  index integer;
BEGIN
  IF parameter_count > 0 THEN
    FOR index IN REVERSE parameter_count..1 LOOP
      rendered := replace(
        rendered,
        '$' || index,
        CASE
          WHEN query_params -> (index - 1) = 'null'::jsonb THEN 'NULL'
          ELSE quote_literal(query_params ->> (index - 1))
        END
      );
    END LOOP;
  END IF;

  IF rendered ~* '^\s*(SELECT|WITH)(\s|$)' THEN
    EXECUTE 'SELECT COALESCE(jsonb_agg(to_jsonb(_row)), ''[]''::jsonb) FROM (' || rendered || ') AS _row' INTO result;
  ELSIF rendered ~* '^\s*(INSERT|UPDATE|DELETE)(\s|$)' AND rendered ~* '(^|\s)RETURNING(\s|$)' THEN
    EXECUTE 'WITH _affected AS (' || rendered || ') SELECT COALESCE(jsonb_agg(to_jsonb(_row)), ''[]''::jsonb) FROM _affected AS _row' INTO result;
  ELSE
    EXECUTE rendered;
  END IF;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.techomie_exec(text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.techomie_exec(text, jsonb) TO service_role;
