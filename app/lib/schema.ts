import "server-only";

import { getPostgresPool } from "@/app/lib/database";

let schemaInitialization: Promise<void> | undefined;

export async function ensureAppSchema() {
  if (!schemaInitialization) {
    schemaInitialization = (async () => {
      const pool = getPostgresPool();
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock(742190531)");
        await client.query(`
          CREATE TABLE IF NOT EXISTS dashboard_organizations (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name TEXT NOT NULL,
            slug TEXT NOT NULL UNIQUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
          )
        `);
        await client.query(`
          INSERT INTO dashboard_organizations (name, slug)
          VALUES ('Northstar Demo', 'northstar-demo')
          ON CONFLICT (slug) DO NOTHING
        `);
        await client.query(`
          CREATE TABLE IF NOT EXISTS dashboard_users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            full_name TEXT NOT NULL,
            email TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            UNIQUE (email)
          )
        `);
        await client.query(`
          CREATE TABLE IF NOT EXISTS dashboard_memberships (
            organization_id UUID NOT NULL REFERENCES dashboard_organizations(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES dashboard_users(id) ON DELETE CASCADE,
            role TEXT NOT NULL CHECK (role IN ('admin', 'analyst', 'viewer')),
            status TEXT NOT NULL CHECK (status IN ('pending', 'active', 'rejected')),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            PRIMARY KEY (organization_id, user_id)
          )
        `);
        await client.query(`
          CREATE TABLE IF NOT EXISTS dashboard_sessions (
            token_hash TEXT PRIMARY KEY,
            user_id UUID NOT NULL REFERENCES dashboard_users(id) ON DELETE CASCADE,
            organization_id UUID REFERENCES dashboard_organizations(id) ON DELETE SET NULL,
            expires_at TIMESTAMPTZ NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
          )
        `);
        await client.query(`
          CREATE TABLE IF NOT EXISTS dashboard_login_attempts (
            email TEXT PRIMARY KEY,
            failed_count INTEGER NOT NULL,
            window_started_at TIMESTAMPTZ NOT NULL
          )
        `);
        await client.query(`
          CREATE TABLE IF NOT EXISTS dashboard_transactions (
            id TEXT NOT NULL,
            customer TEXT NOT NULL,
            email TEXT NOT NULL,
            product TEXT NOT NULL,
            transaction_date DATE NOT NULL,
            amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
            status TEXT NOT NULL CHECK (status IN ('Paid', 'Pending', 'Refunded')),
            order_status TEXT NOT NULL DEFAULT 'Processing'
              CHECK (order_status IN ('Processing', 'Shipped', 'Delivered', 'Cancelled')),
            organization_id UUID
          )
        `);
        await client.query(`
          ALTER TABLE dashboard_transactions
          ADD COLUMN IF NOT EXISTS organization_id UUID
        `);
        await client.query(`
          ALTER TABLE dashboard_transactions
          ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'Uncategorized',
          ADD COLUMN IF NOT EXISTS region TEXT NOT NULL DEFAULT 'Unassigned'
        `);
        await client.query(`
          ALTER TABLE dashboard_transactions
          ADD COLUMN IF NOT EXISTS order_status TEXT NOT NULL DEFAULT 'Processing'
            CHECK (order_status IN ('Processing', 'Shipped', 'Delivered', 'Cancelled'))
        `);
        await client.query(`
          ALTER TABLE dashboard_transactions
          ADD COLUMN IF NOT EXISTS inventory_deducted BOOLEAN NOT NULL DEFAULT false
        `);
        await client.query(`
          UPDATE dashboard_transactions
          SET organization_id = (SELECT id FROM dashboard_organizations WHERE slug = 'northstar-demo')
          WHERE organization_id IS NULL
        `);
        await client.query(`
          ALTER TABLE dashboard_transactions
          ALTER COLUMN organization_id SET NOT NULL
        `);
        await client.query(`
          CREATE TABLE IF NOT EXISTS dashboard_product_categories (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            organization_id UUID NOT NULL REFERENCES dashboard_organizations(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            archived_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            UNIQUE (organization_id, id)
          )
        `);
        await client.query(`
          CREATE UNIQUE INDEX IF NOT EXISTS dashboard_product_categories_org_name_idx
          ON dashboard_product_categories (organization_id, lower(name))
        `);
        await client.query(`
          CREATE TABLE IF NOT EXISTS dashboard_products (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            organization_id UUID NOT NULL REFERENCES dashboard_organizations(id) ON DELETE CASCADE,
            category_id UUID NOT NULL,
            name TEXT NOT NULL,
            sku TEXT NOT NULL DEFAULT '',
            description TEXT NOT NULL DEFAULT '',
            unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
            stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
            low_stock_threshold INTEGER NOT NULL DEFAULT 5 CHECK (low_stock_threshold >= 0),
            image_data BYTEA,
            image_mime TEXT CHECK (image_mime IN ('image/jpeg', 'image/png', 'image/webp', 'image/gif')),
            archived_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            UNIQUE (organization_id, id),
            FOREIGN KEY (organization_id, category_id)
              REFERENCES dashboard_product_categories (organization_id, id) ON DELETE RESTRICT
          )
        `);
        await client.query(`
          CREATE UNIQUE INDEX IF NOT EXISTS dashboard_products_org_name_idx
          ON dashboard_products (organization_id, lower(name))
        `);
        await client.query(`
          CREATE UNIQUE INDEX IF NOT EXISTS dashboard_products_org_sku_idx
          ON dashboard_products (organization_id, lower(sku))
          WHERE sku <> ''
        `);
        await client.query(`
          CREATE TABLE IF NOT EXISTS dashboard_inventory_movements (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            organization_id UUID NOT NULL,
            product_id UUID NOT NULL,
            quantity_delta INTEGER NOT NULL CHECK (quantity_delta <> 0),
            movement_type TEXT NOT NULL CHECK (movement_type IN ('initial_stock', 'adjustment', 'order_shipped', 'order_cancelled')),
            reason TEXT NOT NULL,
            related_order_id TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            FOREIGN KEY (organization_id, product_id)
              REFERENCES dashboard_products (organization_id, id) ON DELETE RESTRICT
          )
        `);
        await client.query(`
          ALTER TABLE dashboard_inventory_movements
          DROP CONSTRAINT IF EXISTS dashboard_inventory_movements_movement_type_check
        `);
        await client.query(`
          ALTER TABLE dashboard_inventory_movements
          ADD CONSTRAINT dashboard_inventory_movements_movement_type_check
          CHECK (movement_type IN ('initial_stock', 'adjustment', 'order_shipped', 'order_cancelled', 'order_restocked'))
        `);
        await client.query(`
          ALTER TABLE dashboard_transactions
          ADD COLUMN IF NOT EXISTS product_id UUID
        `);
        await client.query(`
          INSERT INTO dashboard_product_categories (organization_id, name)
          SELECT DISTINCT organization_id, COALESCE(NULLIF(trim(category), ''), 'Uncategorized')
          FROM dashboard_transactions
          ON CONFLICT (organization_id, lower(name)) DO NOTHING
        `);
        await client.query(`
          INSERT INTO dashboard_products
            (organization_id, category_id, name, unit_price)
          SELECT t.organization_id, c.id, t.product, COALESCE(AVG(t.amount), 0)::numeric(12, 2)
          FROM dashboard_transactions t
          JOIN dashboard_product_categories c
            ON c.organization_id = t.organization_id
           AND lower(c.name) = lower(COALESCE(NULLIF(trim(t.category), ''), 'Uncategorized'))
          GROUP BY t.organization_id, c.id, t.product
          ON CONFLICT (organization_id, lower(name)) DO NOTHING
        `);
        await client.query(`
          UPDATE dashboard_transactions t
          SET product_id = p.id
          FROM dashboard_products p
          WHERE t.product_id IS NULL
            AND p.organization_id = t.organization_id
            AND lower(p.name) = lower(t.product)
        `);
        await client.query(`
          DO $migration$
          BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM information_schema.table_constraints
              WHERE table_schema = 'public'
                AND table_name = 'dashboard_transactions'
                AND constraint_name = 'dashboard_transactions_product_org_fkey'
            ) THEN
              ALTER TABLE dashboard_transactions
              ADD CONSTRAINT dashboard_transactions_product_org_fkey
              FOREIGN KEY (organization_id, product_id)
              REFERENCES dashboard_products (organization_id, id) ON DELETE RESTRICT;
            END IF;
          END;
          $migration$
        `);
        await client.query(`
          CREATE INDEX IF NOT EXISTS dashboard_inventory_movements_product_time_idx
          ON dashboard_inventory_movements (organization_id, product_id, created_at DESC)
        `);
        await client.query(`
          CREATE TABLE IF NOT EXISTS dashboard_customers (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            organization_id UUID NOT NULL REFERENCES dashboard_organizations(id) ON DELETE CASCADE,
            full_name TEXT NOT NULL,
            email TEXT NOT NULL,
            phone TEXT NOT NULL DEFAULT '',
            company TEXT NOT NULL DEFAULT '',
            archived_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            UNIQUE (organization_id, id)
          )
        `);
        await client.query(`
          CREATE UNIQUE INDEX IF NOT EXISTS dashboard_customers_org_email_idx
          ON dashboard_customers (organization_id, lower(email))
        `);
        await client.query(`
          ALTER TABLE dashboard_transactions
          ADD COLUMN IF NOT EXISTS customer_id UUID
        `);
        await client.query(`
          INSERT INTO dashboard_customers (organization_id, full_name, email)
          SELECT organization_id, max(customer), lower(email)
          FROM dashboard_transactions
          GROUP BY organization_id, lower(email)
          ON CONFLICT (organization_id, lower(email)) DO NOTHING
        `);
        await client.query(`
          UPDATE dashboard_transactions t
          SET customer_id = c.id
          FROM dashboard_customers c
          WHERE t.customer_id IS NULL
            AND c.organization_id = t.organization_id
            AND lower(c.email) = lower(t.email)
        `);
        await client.query(`
          DO $migration$
          BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM information_schema.table_constraints
              WHERE table_schema = 'public'
                AND table_name = 'dashboard_transactions'
                AND constraint_name = 'dashboard_transactions_customer_org_fkey'
            ) THEN
              ALTER TABLE dashboard_transactions
              ADD CONSTRAINT dashboard_transactions_customer_org_fkey
              FOREIGN KEY (organization_id, customer_id)
              REFERENCES dashboard_customers (organization_id, id)
              ON DELETE RESTRICT;
            END IF;
          END;
          $migration$
        `);
        await client.query(`
          CREATE TABLE IF NOT EXISTS dashboard_customer_activity (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            organization_id UUID NOT NULL,
            customer_id UUID NOT NULL,
            event_type TEXT NOT NULL,
            description TEXT NOT NULL,
            related_order_id TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            FOREIGN KEY (organization_id, customer_id)
              REFERENCES dashboard_customers (organization_id, id) ON DELETE CASCADE
          )
        `);
        await client.query(`
          CREATE UNIQUE INDEX IF NOT EXISTS dashboard_customer_order_placed_activity_idx
          ON dashboard_customer_activity (organization_id, related_order_id)
          WHERE event_type = 'order_placed' AND related_order_id IS NOT NULL
        `);
        await client.query(`
          INSERT INTO dashboard_customer_activity
            (organization_id, customer_id, event_type, description, related_order_id, created_at)
          SELECT organization_id, customer_id, 'order_placed',
            'Order ' || id || ' placed', id,
            transaction_date::timestamp AT TIME ZONE 'UTC'
          FROM dashboard_transactions
          WHERE customer_id IS NOT NULL
          ON CONFLICT DO NOTHING
        `);
        await client.query(`
          DO $migration$
          DECLARE
            primary_key_name TEXT;
            primary_key_columns TEXT[];
          BEGIN
            SELECT tc.constraint_name, array_agg(kcu.column_name ORDER BY kcu.ordinal_position)
              INTO primary_key_name, primary_key_columns
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON kcu.constraint_name = tc.constraint_name
             AND kcu.constraint_schema = tc.constraint_schema
             AND kcu.table_name = tc.table_name
            WHERE tc.table_schema = 'public'
              AND tc.table_name = 'dashboard_transactions'
              AND tc.constraint_type = 'PRIMARY KEY'
            GROUP BY tc.constraint_name;

            IF primary_key_name IS NOT NULL
              AND primary_key_columns <> ARRAY['organization_id', 'id']::TEXT[] THEN
              EXECUTE format('ALTER TABLE dashboard_transactions DROP CONSTRAINT %I', primary_key_name);
              primary_key_name := NULL;
            END IF;

            IF primary_key_name IS NULL
              AND NOT EXISTS (
                SELECT 1 FROM information_schema.table_constraints
                WHERE table_schema = 'public'
                  AND table_name = 'dashboard_transactions'
                  AND constraint_type = 'PRIMARY KEY'
              ) THEN
              ALTER TABLE dashboard_transactions
              ADD CONSTRAINT dashboard_transactions_pkey PRIMARY KEY (organization_id, id);
            END IF;
          END;
          $migration$
        `);
        await client.query(`
          DO $migration$
          BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM information_schema.table_constraints
              WHERE table_schema = 'public'
                AND table_name = 'dashboard_transactions'
                AND constraint_name = 'dashboard_transactions_organization_id_fkey'
            ) THEN
              ALTER TABLE dashboard_transactions
              ADD CONSTRAINT dashboard_transactions_organization_id_fkey
              FOREIGN KEY (organization_id) REFERENCES dashboard_organizations(id) ON DELETE CASCADE;
            END IF;
          END;
          $migration$
        `);
        await client.query(`
          CREATE INDEX IF NOT EXISTS dashboard_memberships_user_status_idx
          ON dashboard_memberships (user_id, status)
        `);
        await client.query(`
          CREATE INDEX IF NOT EXISTS dashboard_memberships_org_status_idx
          ON dashboard_memberships (organization_id, status)
        `);
        await client.query(`
          CREATE INDEX IF NOT EXISTS dashboard_transactions_org_date_idx
          ON dashboard_transactions (organization_id, transaction_date DESC)
        `);
        await client.query(`
          CREATE INDEX IF NOT EXISTS dashboard_transactions_org_category_idx
          ON dashboard_transactions (organization_id, category)
        `);
        await client.query(`
          CREATE INDEX IF NOT EXISTS dashboard_transactions_org_region_idx
          ON dashboard_transactions (organization_id, region)
        `);
        await client.query(`
          CREATE INDEX IF NOT EXISTS dashboard_transactions_org_order_status_idx
          ON dashboard_transactions (organization_id, order_status)
        `);
        await client.query(`
          CREATE INDEX IF NOT EXISTS dashboard_transactions_org_customer_date_idx
          ON dashboard_transactions (organization_id, customer_id, transaction_date DESC)
        `);
        await client.query(`
          CREATE INDEX IF NOT EXISTS dashboard_transactions_org_product_date_idx
          ON dashboard_transactions (organization_id, product_id, transaction_date DESC)
        `);
        await client.query(`
          CREATE INDEX IF NOT EXISTS dashboard_customer_activity_timeline_idx
          ON dashboard_customer_activity (organization_id, customer_id, created_at DESC)
        `);
        await client.query(`
          DELETE FROM dashboard_sessions WHERE expires_at < now()
        `);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    })().catch((error: unknown) => {
      schemaInitialization = undefined;
      throw error;
    });
  }
  await schemaInitialization;
}
