-- SpecGrid D1 schema
-- Pulled verbatim from the LIVE production database (specgrid-db) on 2026-09-05.
-- This is the source of truth going forward — staging (specgrid-db-staging) had
-- drifted (missing founding_members/sessions/visitor_identities, and carried an
-- unrelated radar_posts table from the deferred Intelligence Radar project).
-- Recreate a fresh D1 with: wrangler d1 execute <db-name> --file=db/schema.sql

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'buyer' CHECK (role IN ('buyer','supplier','admin','editor')),
  email_verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  parent_id TEXT REFERENCES categories(id),
  level INTEGER NOT NULL DEFAULT 1 CHECK (level IN (1,2,3)),
  filter_schema TEXT,
  description TEXT,
  icon TEXT
);

CREATE TABLE companies (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','claimed','founding','verified')),
  category_id TEXT REFERENCES categories(id),
  company_type TEXT CHECK (company_type IN ('manufacturer','trader_distributor','service_provider','epc_contractor','other')),
  public_visible INTEGER NOT NULL DEFAULT 1,
  location_city TEXT,
  location_state TEXT,
  founded_year INTEGER,
  employee_band TEXT,
  description TEXT,
  website TEXT,
  logo_url TEXT,
  source_note TEXT,
  source_urls TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  spec_id TEXT,
  whatsapp_number TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE companies_internal (
  company_id TEXT PRIMARY KEY REFERENCES companies(id),
  legal_data TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE company_claims (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  verification_method TEXT,
  verification_evidence TEXT,
  reviewed_by TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE certifications (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id),
  name TEXT NOT NULL,
  issuing_body TEXT,
  valid_until TEXT,
  verified INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE products (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id),
  category_id TEXT REFERENCES categories(id),
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  specs TEXT,
  embedding_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE content_queue (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  submitted_by TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','auto_approved','rejected')),
  diff TEXT,
  rejection_reason TEXT,
  reviewed_by TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE enquiries (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id),
  buyer_user_id TEXT REFERENCES users(id),
  buyer_name TEXT,
  buyer_email TEXT,
  buyer_phone TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','forwarded','closed')),
  forwarded_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE founding_members (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id),
  amount_paid TEXT,
  payment_reference TEXT,
  notes TEXT,
  marked_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE nurture_sequences (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id),
  step INTEGER NOT NULL CHECK (step BETWEEN 1 AND 4),
  sent_at TEXT,
  opened_at TEXT
);

-- P8: first-party analytics
CREATE TABLE analytics_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  company_slug TEXT,
  meta TEXT,
  visitor_id TEXT,
  session_id TEXT,
  path TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- P8B: attribution
CREATE TABLE sessions (
  session_id TEXT PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  landing_page TEXT,
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_term TEXT,
  utm_content TEXT,
  started_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE visitor_identities (
  visitor_id TEXT NOT NULL,
  user_email TEXT NOT NULL,
  first_identified_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (visitor_id, user_email)
);

-- Indexes (exact set live on production)
CREATE INDEX idx_certifications_company ON certifications(company_id);
CREATE INDEX idx_claims_company ON company_claims(company_id);
CREATE INDEX idx_claims_status ON company_claims(status);
CREATE INDEX idx_companies_category ON companies(category_id);
CREATE INDEX idx_companies_state ON companies(location_state);
CREATE INDEX idx_companies_status ON companies(status);
CREATE INDEX idx_companies_type ON companies(company_type);
CREATE INDEX idx_companies_visible ON companies(public_visible);
CREATE INDEX idx_content_queue_status ON content_queue(status);
CREATE INDEX idx_enquiries_company ON enquiries(company_id);
CREATE INDEX idx_enquiries_status ON enquiries(status);
CREATE INDEX idx_events_type_created ON analytics_events(event_type, created_at);
CREATE INDEX idx_nurture_company ON nurture_sequences(company_id);
CREATE INDEX idx_products_company ON products(company_id);
CREATE INDEX idx_sessions_visitor ON sessions(visitor_id);
