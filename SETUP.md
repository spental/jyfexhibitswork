# FieldDesk — Work Order Portal

A responsive multi-user website for GitHub Pages with Supabase Authentication and Postgres database.

## Included features

- Admin: create and edit work orders, select Yorktown / Central Building / Jamestown, set priority, due date, technician assignment, and checklist tasks.
- Technician: view the shared work-order queue, manage checklists for assigned work orders, log time with work status (completed/not completed) and notes/issues, post comments, start and close work orders, or reopen jobs.
- Dashboard: open, in progress, completed, and per-location counts, plus daily task view.
- Permissions: database Row Level Security makes sure technicians cannot create or edit orders or change other users' roles. Administrators can handle all work orders.
- Updates: refresh the browser or click ↻ to see another user's latest changes. It does **not** push updates automatically in real time.

## Step 1: Create Supabase backend

1. Sign in at https://supabase.com, create a project, and remember your database password.
2. Go to **SQL Editor** and run the entire `supabase-setup.sql` script. On a fresh Supabase project this only needs to run once.
3. Go to **Authentication > Providers > Email** and enable email/password sign-in. Leave email confirmation on for production. If enabled, sign-up users must verify their email.
4. Go to **Project Settings > API** (or the newer **Connect / API Keys** screen) and copy the **Project URL** and the **publishable (or legacy anon)** key. **NEVER use your secret or service_role key in a public website.**

## Step 2: Put the site on GitHub

1. Create a new public GitHub repository, for example `fielddesk-work-orders`.
2. Upload `index.html`, `styles.css`, `app.js`, and `config.js` to the repository root. You may also upload this documentation and the SQL file, but they are not required for the website to run.
3. In repository **Settings > Pages**, select **Deploy from a branch**, choose `main` and `/ (root)`, then Save.
4. Before uploading, open `config.js` in a text editor. Replace BOTH placeholder values with your existing Supabase **Project URL** and **publishable / anon key**. Keep the quotes. **Never enter a service-role or secret key.**
5. Upload `index.html`, `styles.css`, `app.js`, and the configured `config.js` to the root of your GitHub repository (replace existing files).
6. Open the GitHub Pages link in a private/incognito window. It should go directly to **Sign in / Create an account** without asking for workspace details.
7. If you still see **Connect your workspace**, check that the public `config.js` exists in the same folder as `index.html`, contains the two public Supabase values, and Pages has deployed the latest commit.

**Important:** All users share the same configured project automatically. Your existing Supabase data, admin account, and work orders stay unchanged. For security, the frontend's public Supabase key is intentionally visible; Supabase RLS policies must restrict data access. Anyone allowed to sign up can currently read work orders: consider restricted registration if this is for internal staff only.

## Step 3: Create the first administrator

1. On the website choose **Create an account**, fill in your name, email and password, and confirm the email if prompted.
2. Back in the Supabase dashboard, open **SQL Editor** and execute this query, using **your actual sign-up email**:

```sql
update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'YOUR_EMAIL@example.com');
```

3. Refresh your website (sign out and back in if needed). You'll now see **+ New work order** and the **Team** section.
4. Other staff create their own accounts, defaulting to **technician**. Admin assigns orders to them from the new/edit work order form.
5. Additional admins can be promoted with the same SQL query in the Supabase dashboard.

## Daily workflow

- **Administrator:** click **New work order** → enter title, details, location, priority, assigned technician, due date, and optional tasks (one per line) → Create.
- **Technician:** open **My daily tasks**, check off assigned items, click a work order, record hours plus Completed / Not completed and work description/issues, post comments, then **Mark job completed** when finished.
- **Everyone:** open a work order from **Work orders** to see its history. Clicking refresh loads recent changes from the database.

## Important security and operational notes

- This website requires internet access. GitHub Pages serves the static frontend and Supabase securely stores data and accounts. GitHub Pages alone cannot store shared work orders or authenticate users.
- Public account registration is enabled by default. For a private team, turn off open sign-ups in Supabase Authentication after creating staff accounts, then invite/manage accounts in the dashboard. Also consider a private-access deployment for sensitive operational information; anyone who signs up while public sign-ups remain enabled can read work orders.
- `supabase-setup.sql` is designed for a **new** Supabase project and is not a repeatable database migration: rerunning it will fail when RLS policies already exist.
- Time entries record hours (decimal, for example `1.5` = 90 minutes). A 'Completed' time entry records the state of that specific time segment; it does not automatically close the job.
- The status buttons **Start work**, **Mark job completed**, and **Reopen job** change the work-order status. A technician can change status only for their assigned orders.
- Administrators can directly edit orders and assignments. For privacy, avoid storing passwords, personal data, or confidential information in order descriptions or comments.
- The application is a working starter system, not an enterprise service-management platform. Useful future upgrades could include attachments/photos, email alerts, CSV exports, and supervisor sign-off.

## Troubleshooting

- **Not showing admin button:** execute the administrator promotion SQL and refresh.
- **'Failed to fetch' or connection error:** verify the Supabase URL and public key on the website's **Change connection** link on the sign-in page. Check that the SQL script ran and the Supabase project is active.
- **No user/profile record:** verify the new-user database trigger was created by the script; confirm email if configured.
- **Can see tasks but cannot edit:** the technician must be assigned to that work order; administrators can edit all.
- **Other users' changes aren't appearing:** click ↻ refresh, or reload the website.
