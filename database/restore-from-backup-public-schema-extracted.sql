-- Extraído automaticamente de backup Supabase (schema public apenas)
-- Gerado em: 2026-06-26T13:42:27.684Z
-- Revise antes de aplicar em produção.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Name: get_photo_stats(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_photo_stats(p_user_id text) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total', COUNT(*),
    'with_faces', COUNT(*) FILTER (WHERE faces_detected > 0),
    'analyzed', COUNT(*) FILTER (WHERE analyzed = true),
    'with_location', COUNT(*) FILTER (WHERE gps_lat IS NOT NULL AND gps_lng IS NOT NULL),
    'by_year', (
      SELECT json_object_agg(event_year, count)
      FROM (
        SELECT event_year, COUNT(*) as count
        FROM photos
        WHERE user_id = p_user_id AND event_year IS NOT NULL
        GROUP BY event_year
        ORDER BY event_year DESC
      ) years
    ),
    'by_city', (
      SELECT json_object_agg(event_city, count)
      FROM (
        SELECT event_city, COUNT(*) as count
        FROM photos
        WHERE user_id = p_user_id AND event_city IS NOT NULL
        GROUP BY event_city
        ORDER BY count DESC
        LIMIT 10
      ) cities
    ),
    'by_type', (
      SELECT json_object_agg(event_type, count)
      FROM (
        SELECT event_type, COUNT(*) as count
        FROM photos
        WHERE user_id = p_user_id AND event_type IS NOT NULL
        GROUP BY event_type
        ORDER BY count DESC
      ) types
    )
  ) INTO result
  FROM photos
  WHERE user_id = p_user_id;
  
  RETURN result;
END;
$$;



--

-- Name: update_person_photo_count(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_person_photo_count() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    IF NEW.person_id IS NOT NULL THEN
      UPDATE persons
      SET photo_count = (
        SELECT COUNT(DISTINCT photo_id)
        FROM face_descriptors
        WHERE person_id = NEW.person_id
      )
      WHERE id = NEW.person_id;
    END IF;
  END IF;
  
  IF TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN
    IF OLD.person_id IS NOT NULL THEN
      UPDATE persons
      SET photo_count = (
        SELECT COUNT(DISTINCT photo_id)
        FROM face_descriptors
        WHERE person_id = OLD.person_id
      )
      WHERE id = OLD.person_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;



--

-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;



--

-- Name: face_descriptors; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.face_descriptors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    photo_id uuid,
    face_vector double precision[],
    bounding_box jsonb,
    person_id uuid,
    confidence double precision DEFAULT 0.0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);



--

-- Name: TABLE face_descriptors; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.face_descriptors IS 'Armazena vetores faciais extraídos das fotos para reconhecimento';


--

-- Name: COLUMN face_descriptors.face_vector; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.face_descriptors.face_vector IS 'Vetor de 128 dimensões do Face-API.js para comparação';


--

-- Name: COLUMN face_descriptors.bounding_box; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.face_descriptors.bounding_box IS 'Coordenadas do rosto na imagem (x, y, width, height)';


--

-- Name: persons; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.persons (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    photo_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);



--

-- Name: TABLE persons; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.persons IS 'Pessoas identificadas no sistema';


--

-- Name: COLUMN persons.photo_count; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.persons.photo_count IS 'Número de fotos distintas onde a pessoa aparece';


--

-- Name: photo_tags; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.photo_tags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    photo_id uuid,
    tag text NOT NULL,
    tag_type text,
    created_at timestamp with time zone DEFAULT now()
);



--

-- Name: TABLE photo_tags; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.photo_tags IS 'Tags personalizadas associadas às fotos';


--

-- Name: photos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.photos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    drive_id text NOT NULL,
    name text NOT NULL,
    mime_type text NOT NULL,
    width integer,
    height integer,
    size_bytes bigint,
    created_at timestamp with time zone,
    modified_at timestamp with time zone,
    gps_lat double precision,
    gps_lng double precision,
    location_name text,
    person_tag text,
    joy_likelihood text,
    sorrow_likelihood text,
    anger_likelihood text,
    surprise_likelihood text,
    faces_detected integer DEFAULT 0,
    storage_url text,
    thumbnail_url text,
    analyzed boolean DEFAULT false,
    user_id text NOT NULL,
    indexed_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    event_year integer,
    event_month integer,
    event_city text,
    event_type text,
    folder_path text,
    role_tag text
);



--

-- Name: TABLE photos; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.photos IS 'Armazena metadados e análises das fotos do Google Drive';


--

-- Name: COLUMN photos.event_year; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.photos.event_year IS 'Ano extraído do nome da pasta';


--

-- Name: COLUMN photos.event_month; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.photos.event_month IS 'Mês extraído do nome da pasta';


--

-- Name: COLUMN photos.event_city; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.photos.event_city IS 'Cidade extraída do nome da pasta';


--

-- Name: COLUMN photos.event_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.photos.event_type IS 'Tipo de evento extraído do nome da pasta';


--

-- Name: COLUMN photos.folder_path; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.photos.folder_path IS 'Caminho completo da pasta no Drive';


--

-- Name: COLUMN photos.role_tag; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.photos.role_tag IS 'Título/cargo associado à foto';


--

-- Name: photos_with_tags; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.photos_with_tags AS
SELECT
    NULL::uuid AS id,
    NULL::text AS drive_id,
    NULL::text AS name,
    NULL::text AS mime_type,
    NULL::integer AS width,
    NULL::integer AS height,
    NULL::bigint AS size_bytes,
    NULL::timestamp with time zone AS created_at,
    NULL::timestamp with time zone AS modified_at,
    NULL::double precision AS gps_lat,
    NULL::double precision AS gps_lng,
    NULL::text AS location_name,
    NULL::text AS person_tag,
    NULL::text AS joy_likelihood,
    NULL::text AS sorrow_likelihood,
    NULL::text AS anger_likelihood,
    NULL::text AS surprise_likelihood,
    NULL::integer AS faces_detected,
    NULL::text AS storage_url,
    NULL::text AS thumbnail_url,
    NULL::boolean AS analyzed,
    NULL::text AS user_id,
    NULL::timestamp with time zone AS indexed_at,
    NULL::timestamp with time zone AS updated_at,
    NULL::text[] AS tags;



--

-- Name: sync_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sync_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id text NOT NULL,
    status text NOT NULL,
    photos_processed integer DEFAULT 0,
    photos_added integer DEFAULT 0,
    photos_updated integer DEFAULT 0,
    error_message text,
    started_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone
);



--

-- Name: TABLE sync_events; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.sync_events IS 'Histórico de sincronizações com o Google Drive';


--

-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    google_id text NOT NULL,
    email text NOT NULL,
    name text,
    access_token text,
    refresh_token text,
    token_expiry timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);



--

-- Name: TABLE users; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.users IS 'Usuários autenticados com tokens OAuth do Google';


--

-- Name: face_descriptors face_descriptors_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.face_descriptors
    ADD CONSTRAINT face_descriptors_pkey PRIMARY KEY (id);


--

-- Name: persons persons_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.persons
    ADD CONSTRAINT persons_pkey PRIMARY KEY (id);


--

-- Name: photo_tags photo_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.photo_tags
    ADD CONSTRAINT photo_tags_pkey PRIMARY KEY (id);


--

-- Name: photos photos_drive_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.photos
    ADD CONSTRAINT photos_drive_id_key UNIQUE (drive_id);


--

-- Name: photos photos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.photos
    ADD CONSTRAINT photos_pkey PRIMARY KEY (id);


--

-- Name: sync_events sync_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sync_events
    ADD CONSTRAINT sync_events_pkey PRIMARY KEY (id);


--

-- Name: users users_google_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_google_id_key UNIQUE (google_id);


--

-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--

-- Name: idx_face_descriptors_person_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_face_descriptors_person_id ON public.face_descriptors USING btree (person_id);


--

-- Name: idx_face_descriptors_photo_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_face_descriptors_photo_id ON public.face_descriptors USING btree (photo_id);


--

-- Name: idx_persons_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_persons_name ON public.persons USING btree (name);


--

-- Name: idx_photo_tags_photo_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_photo_tags_photo_id ON public.photo_tags USING btree (photo_id);


--

-- Name: idx_photo_tags_tag; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_photo_tags_tag ON public.photo_tags USING btree (tag);


--

-- Name: idx_photos_analyzed; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_photos_analyzed ON public.photos USING btree (analyzed);


--

-- Name: idx_photos_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_photos_created_at ON public.photos USING btree (created_at);


--

-- Name: idx_photos_drive_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_photos_drive_id ON public.photos USING btree (drive_id);


--

-- Name: idx_photos_event_city; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_photos_event_city ON public.photos USING btree (event_city);


--

-- Name: idx_photos_event_month; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_photos_event_month ON public.photos USING btree (event_month);


--

-- Name: idx_photos_event_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_photos_event_type ON public.photos USING btree (event_type);


--

-- Name: idx_photos_event_year; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_photos_event_year ON public.photos USING btree (event_year);


--

-- Name: idx_photos_joy_likelihood; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_photos_joy_likelihood ON public.photos USING btree (joy_likelihood);


--

-- Name: idx_photos_location; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_photos_location ON public.photos USING btree (gps_lat, gps_lng);


--

-- Name: idx_photos_person_tag; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_photos_person_tag ON public.photos USING btree (person_tag);


--

-- Name: idx_photos_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_photos_user_id ON public.photos USING btree (user_id);


--

-- Name: idx_sync_events_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sync_events_status ON public.sync_events USING btree (status);


--

-- Name: idx_sync_events_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sync_events_user_id ON public.sync_events USING btree (user_id);


--

-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--

-- Name: idx_users_google_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_google_id ON public.users USING btree (google_id);


--

-- Name: photos_with_tags _RETURN; Type: RULE; Schema: public; Owner: postgres
--

CREATE OR REPLACE VIEW public.photos_with_tags AS
 SELECT p.id,
    p.drive_id,
    p.name,
    p.mime_type,
    p.width,
    p.height,
    p.size_bytes,
    p.created_at,
    p.modified_at,
    p.gps_lat,
    p.gps_lng,
    p.location_name,
    p.person_tag,
    p.joy_likelihood,
    p.sorrow_likelihood,
    p.anger_likelihood,
    p.surprise_likelihood,
    p.faces_detected,
    p.storage_url,
    p.thumbnail_url,
    p.analyzed,
    p.user_id,
    p.indexed_at,
    p.updated_at,
    array_agg(DISTINCT pt.tag) FILTER (WHERE (pt.tag IS NOT NULL)) AS tags
   FROM (public.photos p
     LEFT JOIN public.photo_tags pt ON ((p.id = pt.photo_id)))
  GROUP BY p.id;


--

-- Name: face_descriptors update_face_descriptors_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_face_descriptors_updated_at BEFORE UPDATE ON public.face_descriptors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--

-- Name: face_descriptors update_person_photo_count_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_person_photo_count_trigger AFTER INSERT OR DELETE OR UPDATE ON public.face_descriptors FOR EACH ROW EXECUTE FUNCTION public.update_person_photo_count();


--

-- Name: persons update_persons_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_persons_updated_at BEFORE UPDATE ON public.persons FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--

-- Name: photos update_photos_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_photos_updated_at BEFORE UPDATE ON public.photos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--

-- Name: users update_users_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--

-- Name: face_descriptors face_descriptors_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.face_descriptors
    ADD CONSTRAINT face_descriptors_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.persons(id) ON DELETE SET NULL;


--

-- Name: face_descriptors face_descriptors_photo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.face_descriptors
    ADD CONSTRAINT face_descriptors_photo_id_fkey FOREIGN KEY (photo_id) REFERENCES public.photos(id) ON DELETE CASCADE;


--

-- Name: photo_tags photo_tags_photo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.photo_tags
    ADD CONSTRAINT photo_tags_photo_id_fkey FOREIGN KEY (photo_id) REFERENCES public.photos(id) ON DELETE CASCADE;


--

-- Name: FUNCTION get_photo_stats(p_user_id text); Type: ACL; Schema: public; Owner: postgres
--



--

-- Name: FUNCTION update_person_photo_count(); Type: ACL; Schema: public; Owner: postgres
--



--

-- Name: FUNCTION update_updated_at_column(); Type: ACL; Schema: public; Owner: postgres
--



--

-- Name: TABLE face_descriptors; Type: ACL; Schema: public; Owner: postgres
--



--

-- Name: TABLE persons; Type: ACL; Schema: public; Owner: postgres
--



--

-- Name: TABLE photo_tags; Type: ACL; Schema: public; Owner: postgres
--



--

-- Name: TABLE photos; Type: ACL; Schema: public; Owner: postgres
--



--

-- Name: TABLE photos_with_tags; Type: ACL; Schema: public; Owner: postgres
--



--

-- Name: TABLE sync_events; Type: ACL; Schema: public; Owner: postgres
--



--

-- Name: TABLE users; Type: ACL; Schema: public; Owner: postgres
--



--

-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--



--

-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--



--

-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: postgres
--



--

-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--



--

-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--



--

-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--



--