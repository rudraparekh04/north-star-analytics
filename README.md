## Local setup

1. Install dependencies with `npm install`.
2. Create a PostgreSQL database and copy `.env.example` to `.env.local`.
3. Set `DATABASE_URL` to your PostgreSQL connection string. Set `SESSION_SECRET` to a random value of at least 32 characters; for example:

   ```bash
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```

   Set `DATABASE_SSL=true` if your PostgreSQL provider requires TLS. Keep `.env.local` private and out of version control.
4. Run `npm run dev` and open [http://localhost:3000](http://localhost:3000). The app initializes its PostgreSQL schema on first use and seeds the `northstar-demo` workspace and sample transactions without overwriting existing transaction rows.
5. Create the first account at `/sign-up`, selecting `Northstar Demo`. New accounts are assigned a pending viewer membership; **email is not sent or verified**.
6. Promote the initial administrator directly in PostgreSQL, replacing the email with the first account’s email:

   ```sql
   UPDATE dashboard_memberships
   SET role = 'admin', status = 'active', updated_at = now()
   WHERE user_id = (SELECT id FROM dashboard_users WHERE email = lower('admin@example.com'))
     AND organization_id = (SELECT id FROM dashboard_organizations WHERE slug = 'northstar-demo');
   ```

   The command should update exactly one row. Sign in again to enter the workspace. Admins can approve or reject membership requests, assign the `admin`, `analyst`, or `viewer` role within their organization, create isolated organizations, and reset member passwords. A password reset revokes that member’s active sessions. Since email delivery is disabled, members who forget their password must contact an organization admin.

## Deploy to Vercel

The project can be deployed as a standard Next.js application. It needs a persistent PostgreSQL database; product image files are stored in that database, not on the Vercel filesystem.

1. **Prepare the GitHub repository.** In the project folder, check that `.env.local` is ignored and is not already tracked before staging files:

   ```bash
   git status --short
   git check-ignore -v .env.local
   git ls-files .env.local
   ```

   The last command should print nothing. If `.env.local` is tracked, stop and remove it from Git tracking before pushing; never publish its database URL or session secret. Then stage and commit the project, create an empty GitHub repository, and push the branch to it. Do not upload `.env.local`.

2. **Create a production Neon database.** Create a Neon project (or connect Neon through Vercel's Marketplace integration), then copy the pooled PostgreSQL connection string. Keep this credential private. For a database that already contains important data, take a backup before connecting the application; application startup creates or updates tables and seeds the `Northstar Demo` workspace.

3. **Import the GitHub repository into Vercel.** Choose the repository in Vercel's **Add New Project** flow and keep the detected Next.js framework and default build settings.

4. **Set Production environment variables** in the Vercel project settings:

   - `DATABASE_URL`: the Neon pooled connection string.
   - `DATABASE_SSL`: `true`.
   - `SESSION_SECRET`: a newly generated random secret of at least 32 characters. Generate one locally with:

     ```bash
     node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
     ```

   Do not use the example secret or share these values. Initially, scope the database and session variables to **Production** only; do not point Preview deployments at the production database. Add a separate preview database before enabling those variables for Preview.

5. **Deploy and create the administrator.** Once deployment succeeds, open the deployed site's `/sign-up` page and create the first account using `Northstar Demo`. The account starts with a pending viewer membership. In the Neon SQL editor, run the administrator promotion SQL from Local setup, replacing the example email with that account's email. Confirm it updates exactly one row, then sign in again.

6. **Smoke-test production.** Check sign-in, dashboard analytics, orders, customers, product creation, image upload, and an inventory adjustment. Existing order history cannot be used to infer current inventory, so migrated products start at zero stock; set their stock before shipping linked orders.

Vercel's [Next.js deployment guide](https://vercel.com/docs/frameworks/full-stack/nextjs) and Neon's [Vercel integration guide](https://neon.com/docs/guides/vercel-overview) cover the provider setup. Vercel hosts the application; Neon hosts the PostgreSQL database.

## Features

- Database-backed email/password accounts and HTTP-only PostgreSQL sessions.
- Protected dashboard and organization-specific roles (`admin`, `analyst`, `viewer`).
- Admin approval for new organization memberships and tenant-scoped transaction data.
- Server-side PostgreSQL search, status filtering, sorting, and pagination.
- Date-filtered revenue, order, customer, and average-order-value KPIs with previous-month comparisons.
- Daily, weekly, and monthly sales trends; revenue breakdowns by category and region; and top-selling products.
- Customizable dashboard widgets saved in the current browser.
- Paginated order management with order/customer search, payment and fulfillment filters, and date/amount/customer sorting.
- Organization-scoped order details, single and bulk fulfillment updates, and filtered CSV exports.
- Product catalog management with categories, archived-product recovery, and organization-scoped image uploads stored in PostgreSQL (JPEG, PNG, GIF, or WebP; maximum 2 MB).
- Inventory quantities, configurable low-stock thresholds, adjustment reasons, and a 50-entry movement history.
- Product sales performance by paid order count and net revenue, including refunds; shipping/delivery deducts one unit per order and cancellation or fulfillment reversal restores it.
- Organization-scoped customer directory and profiles with paginated purchase history, lifetime spend, activity timeline, and editable contact details.
- Customer segments: high value at $1,000+ net lifetime spend, repeat at 2+ paid orders, otherwise new; repeat rate uses active customers with at least one paid order as the denominator.
- Customer deletion archives the profile and preserves its order history; archived profiles can be restored.
- Loading skeletons and a retryable database error screen.

Search, filters, sorting, and pagination use parameterized PostgreSQL queries. Auth forms validate input and display database/action errors inline.
Dashboard revenue counts paid orders and subtracts refunded orders; active customers are distinct customers with a paid order, and average order value is net revenue per paid order. Transaction records include category and region fields. Existing records default to `Uncategorized` and `Unassigned` until those values are populated; the built-in demo records include illustrative categories and regions. Inventory starts at zero for products migrated from existing transaction history because historical stock balances cannot be inferred. Set their starting quantities through an inventory adjustment before shipping linked orders.

Run `npm run lint`, `npx tsc --noEmit`, and `npm run build` to validate changes.
