# TOPSMMA Call Hub

A cold call queue, pipeline and P&L tracker, built to match the Lead Hub
reference you showed me, rebuilt for TOPSMMA's own UK aesthetic clinic
outreach rather than copied from anyone else's tool.

Built with Next.js (App Router) and Supabase (Postgres database + logins).
Hosted free on Vercel at your current scale.

## What is built so far

- Real username and password login (Supabase Auth), no public sign up,
  accounts are created by you in the Supabase dashboard.
- Call queue page: your assigned leads, a UK call window indicator,
  today's call stats, a lead detail card with clickable pipeline stages,
  one click call logging (Connected / Voicemail / No Answer), and an
  Up Next list.
- Team & pool page: the unassigned lead pool by tier, and a card per
  teammate showing their load and last 7 days of activity, with a
  Return uncalled action.
- Row level security in the database, so a rep only ever sees their own
  assigned leads and the shared pool, never each other's numbers or the
  company's financials.

Not built yet, intentionally, this was scoped as the first module:
Inbox, Tasks, Pipeline board view, Reports/P&L page, Emails, Scripts,
Playbook, AI brief generation, and lead import. The sidebar shows these
as greyed out placeholders so the shape of the app is visible, nothing
underneath is broken, they just are not built.

## Deploying this, step by step

### 1. Create your Supabase project

1. Go to supabase.com and sign up (free).
2. Click "New project". Pick any name, a strong database password (save
   it somewhere, you will not need to type it anywhere in this app, it
   is just Supabase's own backup), and the region closest to the UK.
3. Wait about two minutes for it to finish provisioning.
4. In the left sidebar, open the SQL Editor.
5. Open `schema.sql` from this project (it's in the same folder as this
   README), copy its full contents, paste into the SQL editor, and click
   Run. You should see a column of "CREATE TABLE" / "CREATE POLICY"
   style success messages and no red errors.
6. In the left sidebar, open Project Settings > API. You will need two
   values from this page in step 3 below: the Project URL, and the
   "anon" "public" key.

### 2. Create your own login

1. In the Supabase dashboard, open Authentication > Users.
2. Click "Add user" > "Create new user".
3. Enter your own email and a password, and make sure "Auto Confirm
   User" is switched on, then create.
4. Back in the SQL Editor, run this one line, with your real email in
   place of the placeholder, to make yourself an admin:
   `update profiles set role = 'admin' where email = 'you@yourdomain.com';`
5. Repeat the "Add user" step later for each teammate, whenever you are
   ready, that is what lets you simply hand them a username and
   password. Their profile row is created automatically the moment you
   add them, they do not need to do anything themselves first.

### 3. Put the code on GitHub

1. Go to github.com and sign up (free), if you don't have an account.
2. Click the "+" in the top right, "New repository". Name it something
   like `topsmma-call-hub`, keep it Private, and click "Create
   repository".
3. On the next screen, click "uploading an existing file".
4. Unzip the file I sent you, then drag the whole unzipped folder's
   contents (not the zip itself) into the upload box. This can take a
   minute for all the files to attach.
5. Scroll down and click "Commit changes".

### 4. Deploy to Vercel

1. Go to vercel.com and sign up (free), choosing "Continue with GitHub"
   so the two are connected automatically.
2. Click "Add New" > "Project".
3. Find `topsmma-call-hub` in the list and click "Import".
4. Before clicking Deploy, open "Environment Variables" and add two:
   - `NEXT_PUBLIC_SUPABASE_URL` = the Project URL from step 1.6
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = the anon public key from step 1.6
5. Click Deploy. After a minute or two you will get a live `.vercel.app`
   link, that is the website, go to it and sign in with the login you
   created in step 2.

From here on, any time I hand you updated code, you repeat step 3
(upload the new files to the same GitHub repository, overwriting the
old ones) and Vercel redeploys automatically within a minute or two,
step 4 does not need repeating.

## Local development (optional, only if you ever want to run this on
your own computer rather than editing through me)

```
npm install
cp .env.example .env.local   # then fill in the two Supabase values
npm run dev
```
