-- Research Resource Manager database schema
-- PostgreSQL 13+
--
-- DBeaver setup:
-- 1. Connect to the PostgreSQL server and run this separately:
--      CREATE DATABASE research_resource_manager;
-- 2. Connect to research_resource_manager, then run this script.
--
-- This schema uses snake_case names suitable for Sequelize with underscored: true.
-- JWTs are not stored in the database; passwords must be bcrypt hashes.

BEGIN;

CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TYPE app_user_role AS ENUM (
    'user',
    'manager',
    'administrator'
);

CREATE TYPE resource_type AS ENUM (
    'equipment',
    'robot',
    'cluster',
    'laboratory',
    'room'
);

CREATE TYPE resource_state AS ENUM (
    'available',
    'unavailable',
    'maintenance'
);

CREATE TYPE reservation_state AS ENUM (
    'pending',
    'confirmed',
    'in_progress',
    'completed',
    'cancelled',
    'rejected',
    'expired'
);

CREATE TYPE waitlist_state AS ENUM (
    'waiting',
    'notified',
    'confirmed',
    'expired'
);

CREATE TYPE notification_type AS ENUM (
    'booking_confirmed',
    'booking_cancelled',
    'slot_available',
    'resource_maintenance'
);

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name       VARCHAR(200) NOT NULL,
    email           VARCHAR(320) NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    role            app_user_role NOT NULL DEFAULT 'user',
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT users_full_name_not_blank CHECK (btrim(full_name) <> ''),
    CONSTRAINT users_email_not_blank CHECK (btrim(email) <> ''),
    CONSTRAINT users_password_hash_not_blank CHECK (btrim(password_hash) <> '')
);

CREATE TABLE resources (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(200) NOT NULL,
    type            resource_type NOT NULL,
    description     TEXT NOT NULL DEFAULT '',
    location        VARCHAR(300) NOT NULL,
    state           resource_state NOT NULL DEFAULT 'available',
    specifications JSONB NOT NULL DEFAULT '{}'::JSONB,
    manager_id      UUID,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT resources_name_not_blank CHECK (btrim(name) <> ''),
    CONSTRAINT resources_location_not_blank CHECK (btrim(location) <> ''),
    CONSTRAINT resources_specifications_object CHECK (jsonb_typeof(specifications) = 'object'),
    CONSTRAINT resources_manager_fk
        FOREIGN KEY (manager_id) REFERENCES users (id) ON DELETE RESTRICT
);

CREATE TABLE reservations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL,
    resource_id     UUID NOT NULL,
    starts_at       TIMESTAMPTZ NOT NULL,
    ends_at         TIMESTAMPTZ NOT NULL,
    purpose         TEXT NOT NULL DEFAULT '',
    team_name       VARCHAR(200),
    status          reservation_state NOT NULL DEFAULT 'pending',
    reviewed_by     UUID,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT reservations_valid_interval CHECK (starts_at < ends_at),
    CONSTRAINT reservations_user_fk
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT,
    CONSTRAINT reservations_resource_fk
        FOREIGN KEY (resource_id) REFERENCES resources (id) ON DELETE RESTRICT,
    CONSTRAINT reservations_reviewer_fk
        FOREIGN KEY (reviewed_by) REFERENCES users (id) ON DELETE RESTRICT,
    CONSTRAINT reservations_no_active_overlap
        EXCLUDE USING GIST (
            resource_id WITH =,
            tstzrange(starts_at, ends_at, '[)') WITH &&
        )
        WHERE (status IN ('pending', 'confirmed', 'in_progress'))
);

CREATE TABLE waitlist_entries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL,
    resource_id     UUID NOT NULL,
    desired_start   TIMESTAMPTZ NOT NULL,
    desired_end     TIMESTAMPTZ NOT NULL,
    requirements    JSONB NOT NULL DEFAULT '{}'::JSONB,
    status          waitlist_state NOT NULL DEFAULT 'waiting',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT waitlist_valid_interval CHECK (desired_start < desired_end),
    CONSTRAINT waitlist_requirements_object CHECK (jsonb_typeof(requirements) = 'object'),
    CONSTRAINT waitlist_user_fk
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT,
    CONSTRAINT waitlist_resource_fk
        FOREIGN KEY (resource_id) REFERENCES resources (id) ON DELETE RESTRICT
);

CREATE TABLE notifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL,
    reservation_id  UUID,
    message         TEXT NOT NULL,
    type            notification_type NOT NULL,
    is_read         BOOLEAN NOT NULL DEFAULT FALSE,
    email_sent      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT notifications_message_not_blank CHECK (btrim(message) <> ''),
    CONSTRAINT notifications_user_fk
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT,
    CONSTRAINT notifications_reservation_fk
        FOREIGN KEY (reservation_id) REFERENCES reservations (id) ON DELETE SET NULL
);

CREATE TABLE feedback (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL,
    resource_id     UUID NOT NULL,
    rating          SMALLINT NOT NULL,
    message         TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT feedback_rating_range CHECK (rating BETWEEN 1 AND 5),
    CONSTRAINT feedback_message_not_blank CHECK (btrim(message) <> ''),
    CONSTRAINT feedback_user_fk
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT,
    CONSTRAINT feedback_resource_fk
        FOREIGN KEY (resource_id) REFERENCES resources (id) ON DELETE RESTRICT
);

CREATE TABLE resource_rules (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_id     UUID NOT NULL,
    title           VARCHAR(200) NOT NULL,
    content         TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT resource_rules_title_not_blank CHECK (btrim(title) <> ''),
    CONSTRAINT resource_rules_content_not_blank CHECK (btrim(content) <> ''),
    CONSTRAINT resource_rules_resource_fk
        FOREIGN KEY (resource_id) REFERENCES resources (id) ON DELETE RESTRICT
);

CREATE TABLE maintenance_blocks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_id     UUID NOT NULL,
    starts_at       TIMESTAMPTZ NOT NULL,
    ends_at         TIMESTAMPTZ NOT NULL,
    reason          TEXT NOT NULL,
    created_by      UUID,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT maintenance_valid_interval CHECK (starts_at < ends_at),
    CONSTRAINT maintenance_reason_not_blank CHECK (btrim(reason) <> ''),
    CONSTRAINT maintenance_resource_fk
        FOREIGN KEY (resource_id) REFERENCES resources (id) ON DELETE RESTRICT,
    CONSTRAINT maintenance_creator_fk
        FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE RESTRICT,
    CONSTRAINT maintenance_no_overlap
        EXCLUDE USING GIST (
            resource_id WITH =,
            tstzrange(starts_at, ends_at, '[)') WITH &&
        )
);

-- Case-insensitive email uniqueness and account-name search.
CREATE UNIQUE INDEX users_email_lower_uq ON users (lower(email));
CREATE INDEX users_full_name_trgm_idx ON users USING GIN (full_name gin_trgm_ops);
CREATE INDEX users_role_active_idx ON users (role, is_active);

-- Catalog filtering and substring search used by the resource catalog.
CREATE INDEX resources_type_state_idx ON resources (type, state) WHERE is_active;
CREATE INDEX resources_manager_id_idx ON resources (manager_id);
CREATE INDEX resources_name_trgm_idx ON resources USING GIN (name gin_trgm_ops);
CREATE INDEX resources_description_trgm_idx ON resources USING GIN (description gin_trgm_ops);
CREATE INDEX resources_location_trgm_idx ON resources USING GIN (location gin_trgm_ops);

-- The exclusion constraint also creates a GiST index; these indexes support
-- user booking lists and chronological resource-calendar queries.
CREATE INDEX reservations_user_start_idx ON reservations (user_id, starts_at DESC);
CREATE INDEX reservations_resource_start_idx ON reservations (resource_id, starts_at);
CREATE INDEX reservations_status_start_idx ON reservations (status, starts_at);
CREATE INDEX reservations_reviewer_id_idx ON reservations (reviewed_by);

-- Queue order is derived from created_at and id; no stale position is stored.
CREATE INDEX waitlist_resource_status_created_idx
    ON waitlist_entries (resource_id, status, created_at, id);
CREATE INDEX waitlist_user_created_idx ON waitlist_entries (user_id, created_at DESC);

CREATE INDEX notifications_user_created_idx ON notifications (user_id, created_at DESC);
CREATE INDEX notifications_unread_idx ON notifications (user_id, created_at DESC)
    WHERE NOT is_read;
CREATE INDEX notifications_reservation_id_idx ON notifications (reservation_id);

CREATE INDEX feedback_resource_created_idx ON feedback (resource_id, created_at DESC);
CREATE INDEX feedback_user_created_idx ON feedback (user_id, created_at DESC);
CREATE INDEX feedback_message_trgm_idx ON feedback USING GIN (message gin_trgm_ops);

CREATE INDEX resource_rules_resource_id_idx ON resource_rules (resource_id);
CREATE INDEX resource_rules_title_trgm_idx ON resource_rules USING GIN (title gin_trgm_ops);
CREATE INDEX resource_rules_content_trgm_idx ON resource_rules USING GIN (content gin_trgm_ops);

CREATE INDEX maintenance_resource_start_idx ON maintenance_blocks (resource_id, starts_at);
CREATE INDEX maintenance_creator_id_idx ON maintenance_blocks (created_by);

COMMIT;
