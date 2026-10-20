export function DatabaseSetup({ message }: { message: string }) {
  return (
    <section className="mx-auto max-w-xl rounded-xl bg-card p-5 ring-1 ring-foreground/10">
      <h1 className="text-2xl font-bold tracking-tight">Database needed</h1>
      <p className="mt-3 text-base leading-7">{message}</p>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        Locally, leave the database variables unset and Skrappily uses{" "}
        <code>data/skrappily.db</code>. On Vercel, set <code>LIBSQL_URL</code> and{" "}
        <code>LIBSQL_AUTH_TOKEN</code> from a Turso database.
      </p>
    </section>
  );
}
