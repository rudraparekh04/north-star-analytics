# Northstar Analytics

A full-stack analytics and operations dashboard for monitoring business performance, managing orders and customers, and keeping a product catalog and inventory up to date.

Northstar Analytics is built with Next.js and PostgreSQL. It supports multiple organizations with role-based access and includes sample transactions for the **Northstar Demo** workspace.

## Features

### Analytics dashboard

- Revenue, order, active-customer, and average-order-value metrics with previous-month comparisons.
- Daily, weekly, and monthly sales trends.
- Revenue breakdowns by category and region, top-selling products, and recent transactions.
- Date-range filters and browser-saved dashboard widget preferences.

### Order management

- Search orders by order ID or customer, with payment and fulfillment filters.
- Paginated order list with date, amount, and customer sorting.
- Create orders from active products, order detail pages, single and bulk fulfillment updates, and CSV export.

### Customer management

- Searchable, segmentable customer directory and customer profiles.
- Purchase history, lifetime spend, repeat-customer rate, and activity timeline.
- Add and edit profiles. Archiving a customer preserves their order history.

### Products and inventory

- Product catalog and category management, with product archive and restore.
- PostgreSQL-backed product image uploads (JPEG, PNG, GIF, or WebP; maximum 2 MB).
- Stock adjustments with reasons, configurable low-stock thresholds, and movement history.
- Product sales performance by paid order count and net revenue.
- Orders marked **Shipped** or **Delivered** deduct one unit of stock; cancellation or reversing fulfillment restores it. Insufficient stock prevents the update.

### Accounts and access

- Email and password accounts with database-backed sessions.
- Organization roles: `admin`, `analyst`, and `viewer`.
- New memberships start as pending viewer requests and require admin approval.
- Organization-scoped data and role checks on server-side writes.

## Tech stack

- [Next.js](https://nextjs.org/) App Router
- [React](https://react.dev/) and [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- PostgreSQL via [`pg`](https://node-postgres.com/)
- [`bcryptjs`](https://github.com/dcodeIO/bcrypt.js) for password hashing
- [Vercel](https://vercel.com/) for hosting and [Neon](https://neon.tech/) for PostgreSQL (recommended deployment setup)

## Getting started

### Requirements

- Node.js 20.9 or later
- npm
- A PostgreSQL database

### Install and configure

1. Clone the repository and install dependencies:

   ```bash
   git clone https://github.com/<your-github-username>/northstar-analytics.git
   cd northstar-analytics
   npm install
   ```

2. Copy `.env.example` to `.env.local` and configure the values:

   ```env
   DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require
   SESSION_SECRET=replace-with-a-random-secret-at-least-32-characters-long
   DATABASE_SSL=true
   ```

   For a local PostgreSQL instance that does not use TLS, set `DATABASE_SSL=false`. Generate a strong session secret locally:

   ```bash
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```

   Keep `.env.local` private. Never commit or share the database URL or session secret.

3. Start the development server:

   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000). On first database use, the app initializes its schema and seeds the `Northstar Demo` organization and sample transactions. The schema setup runs transactionally and uses an advisory lock.

## First admin setup

1. Register an account at `/sign-up`, selecting **Northstar Demo**. Signup creates a pending membership; access is not available until it is approved.
2. Connect to the same PostgreSQL database used by the app and run this query, replacing the email with the address you registered:

   ```sql
   UPDATE dashboard_memberships AS m
   SET role = 'admin',
       status = 'active',
       updated_at = now()
   FROM dashboard_users AS u,
        dashboard_organizations AS o
   WHERE m.user_id = u.id
     AND m.organization_id = o.id
     AND lower(u.email) = lower('admin@example.com')
     AND o.slug = 'northstar-demo'
   RETURNING u.email, o.name, m.role, m.status;
   ```

3. Confirm the result shows `admin` and `active`, then sign in again.

If the query returns no rows, confirm signup completed and that you are connected to the same database as the application. Admins can approve and manage other memberships from the app. Email delivery and self-service password recovery are not configured.

## Deploying to Vercel with Neon

1. Push the project to GitHub. Verify `.env.local` is ignored and not tracked before pushing:

   ```bash
   git check-ignore -v .env.local
   git ls-files .env.local
   ```

   `git ls-files .env.local` should print nothing. Do not commit environment secrets.
2. Create a PostgreSQL project in Neon and copy its pooled connection string. Keep it private.
3. Import the GitHub repository into Vercel as a Next.js project.
4. In Vercel project settings, add these environment variables for **Production**:
   - `DATABASE_URL`: the Neon pooled connection string.
   - `DATABASE_SSL`: `true`.
   - `SESSION_SECRET`: a fresh random secret, at least 32 characters long.
5. Deploy the project. Create your account at the deployed app’s `/sign-up` page, then use Neon’s SQL Editor to run the first-admin query above.
6. Smoke-test sign-in, dashboard data, orders, customers, product management, image uploads, and inventory adjustments.

Use a separate database for Preview deployments. Do not point previews at a production database unless that is intentional.

The app stores product image bytes in PostgreSQL. Existing order history cannot be used to infer current stock, so products migrated from old transactions start with zero inventory; set their stock before shipping linked orders.

## Useful commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run lint` | Run ESLint |
| `npx tsc --noEmit` | Check TypeScript types |
| `npm run build` | Create a production build |
| `npm run start` | Run the production server |

## Metric definitions

- Dashboard revenue counts paid orders and subtracts refunded amounts.
- Dashboard order count excludes orders with a cancelled fulfillment status; cancelled orders remain visible in the order list.
- Active customers are distinct customers with a paid order in the selected date range.
- Average order value is net revenue divided by the number of paid orders.
- Customer segments: **High value** at $1,000 or more net lifetime spend; otherwise **Repeat** at two or more paid orders; otherwise **New**.
- Repeat-customer rate is repeat paid customers divided by active customers with at least one paid order.
- Product performance shows paid order count and net revenue after refunds.

## Security notes

- Configure production secrets in Vercel environment settings, not in source control.
- Use a private, persistent PostgreSQL database and TLS for production connections.
- Database reads and writes are scoped to the signed-in organization; server actions check roles before changing data.
- The app does not send signup verification or password-recovery email. Admins handle membership approvals and password resets.

