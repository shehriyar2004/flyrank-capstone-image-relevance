CREATE TABLE tenants (
 id uuid PRIMARY KEY, name text NOT NULL, key_hash char(64) UNIQUE NOT NULL,
 call_budget integer NOT NULL CHECK(call_budget>=0), reserved_calls integer NOT NULL DEFAULT 0 CHECK(reserved_calls>=0),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE images (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id),
 manifest_id text NOT NULL, sha256 char(64) NOT NULL, file_path text NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','ready','flagged','failed')),
 metadata_version text, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,id), UNIQUE(tenant_id,manifest_id), UNIQUE(tenant_id,sha256)
);
CREATE INDEX images_tenant_status ON images(tenant_id,status);
CREATE TABLE image_tags (
 tenant_id uuid NOT NULL, image_id uuid NOT NULL, version text NOT NULL, model text NOT NULL,
 metadata jsonb NOT NULL CHECK(jsonb_typeof(metadata)='object'), raw_response text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(tenant_id,image_id,version),
 FOREIGN KEY(tenant_id,image_id) REFERENCES images(tenant_id,id)
);
CREATE TABLE posts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id),
 title text NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 200), content text NOT NULL CHECK(length(trim(content)) BETWEEN 1 AND 4000),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','ready','flagged','failed')),
 intent jsonb, intent_version text, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id,id)
);
CREATE INDEX posts_tenant_status ON posts(tenant_id,status);
CREATE TABLE embeddings (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL,
 image_id uuid, post_id uuid, model text NOT NULL, dimensions integer NOT NULL CHECK(dimensions>0),
 vector double precision[] NOT NULL, input_hash char(64) NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(num_nonnulls(image_id,post_id)=1), CHECK(array_length(vector,1)=dimensions),
 CHECK(NOT ('NaN'::float8=ANY(vector)) AND NOT ('Infinity'::float8=ANY(vector)) AND NOT ('-Infinity'::float8=ANY(vector))),
 FOREIGN KEY(tenant_id,image_id) REFERENCES images(tenant_id,id), FOREIGN KEY(tenant_id,post_id) REFERENCES posts(tenant_id,id),
 UNIQUE NULLS NOT DISTINCT(tenant_id,image_id,post_id,model,input_hash)
);
CREATE INDEX embeddings_image_owner ON embeddings(tenant_id,image_id,model);
CREATE INDEX embeddings_post_owner ON embeddings(tenant_id,post_id,model);
CREATE TABLE jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN ('image','post')), image_id uuid, post_id uuid,
 entity_id uuid GENERATED ALWAYS AS (coalesce(image_id,post_id)) STORED, version text NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','running','succeeded','failed')),
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 3),
 available_at timestamptz NOT NULL DEFAULT now(), lease_until timestamptz, lease_token uuid, worker_id text,
 progress integer NOT NULL DEFAULT 0 CHECK(progress BETWEEN 0 AND 100), result jsonb, error_code text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK((kind='image' AND image_id IS NOT NULL AND post_id IS NULL) OR (kind='post' AND post_id IS NOT NULL AND image_id IS NULL)),
 FOREIGN KEY(tenant_id,image_id) REFERENCES images(tenant_id,id), FOREIGN KEY(tenant_id,post_id) REFERENCES posts(tenant_id,id),
 UNIQUE(tenant_id,id), UNIQUE(tenant_id,kind,entity_id,version)
);
CREATE INDEX jobs_claim ON jobs(status,available_at,created_at);
CREATE INDEX jobs_expired_leases ON jobs(lease_until) WHERE status='running';
CREATE INDEX jobs_tenant_entity ON jobs(tenant_id,kind,entity_id);
CREATE TABLE suggestions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, post_id uuid NOT NULL, image_id uuid NOT NULL,
 score double precision NOT NULL CHECK(score BETWEEN -1 AND 1), snapshot jsonb NOT NULL,
 post_version text NOT NULL, image_version text NOT NULL, threshold_version text NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id,id),
 FOREIGN KEY(tenant_id,post_id) REFERENCES posts(tenant_id,id), FOREIGN KEY(tenant_id,image_id) REFERENCES images(tenant_id,id),
 UNIQUE(tenant_id,post_id,image_id,post_version,image_version,threshold_version)
);
CREATE INDEX suggestions_post ON suggestions(tenant_id,post_id,score DESC);
CREATE TABLE reviews (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, suggestion_id uuid NOT NULL,
 action text NOT NULL CHECK(action IN ('approve','reject')), explanation text,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id,suggestion_id),
 FOREIGN KEY(tenant_id,suggestion_id) REFERENCES suggestions(tenant_id,id)
);
CREATE TABLE ai_calls (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), job_id uuid,
 entity_id uuid NOT NULL, operation text NOT NULL, model text NOT NULL, provider text NOT NULL DEFAULT 'ollama' CHECK(provider='ollama'),
 attempt integer NOT NULL, status text NOT NULL DEFAULT 'reserved' CHECK(status IN ('reserved','succeeded','error','abandoned')),
 input_tokens integer, output_tokens integer, duration_ms double precision, cost_usd numeric(12,6) NOT NULL DEFAULT 0 CHECK(cost_usd=0),
 error_code text, created_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz,
 FOREIGN KEY(tenant_id,job_id) REFERENCES jobs(tenant_id,id)
);
CREATE INDEX ai_calls_tenant_created ON ai_calls(tenant_id,created_at);
CREATE INDEX ai_calls_job ON ai_calls(tenant_id,job_id);
CREATE TABLE alerts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), job_id uuid,
 kind text NOT NULL, message text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,job_id) REFERENCES jobs(tenant_id,id), UNIQUE NULLS NOT DISTINCT(tenant_id,job_id,kind)
);
CREATE INDEX alerts_tenant_created ON alerts(tenant_id,created_at);
CREATE TABLE idempotency (
 tenant_id uuid NOT NULL REFERENCES tenants(id), operation text NOT NULL, key text NOT NULL,
 payload_hash char(64) NOT NULL, response_status integer, response_body jsonb,
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(tenant_id,operation,key)
);
