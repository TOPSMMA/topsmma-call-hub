import { signIn } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="min-h-screen flex items-center justify-center bg-base px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-9 h-9 rounded-lg bg-card flex items-center justify-center font-extrabold text-accentlight">
            TS
          </div>
          <div>
            <div className="font-bold text-sm leading-tight">Call Hub</div>
            <div className="text-xs text-muted">TOPSMMA</div>
          </div>
        </div>

        <form
          action={signIn}
          className="bg-card border border-line rounded-2xl p-6 flex flex-col gap-4"
        >
          <div>
            <label className="block text-xs text-muted mb-1.5" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full bg-panel border border-line rounded-lg px-3 py-2.5 text-sm outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1.5" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full bg-panel border border-line rounded-lg px-3 py-2.5 text-sm outline-none focus:border-accent"
            />
          </div>

          {error && (
            <div className="text-xs text-bad bg-bad/10 border border-bad/30 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="mt-1 bg-accent hover:bg-accentlight transition-colors text-white font-semibold text-sm rounded-lg px-4 py-2.5"
          >
            Sign in
          </button>
        </form>

        <p className="text-center text-xs text-dim mt-5">
          Accounts are created by an admin in Supabase, there is no public sign up.
        </p>
      </div>
    </div>
  );
}
