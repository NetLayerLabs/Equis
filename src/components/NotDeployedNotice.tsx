export function NotDeployedNotice({ title, description }: { title: string; description: string }) {
  return (
    <section className="rounded-lg border border-dashed border-line bg-panel/60 p-5">
      <h2 className="text-sm font-medium text-text">{title}</h2>
      <p className="mt-2 max-w-prose text-xs leading-relaxed text-muted">{description}</p>
      <code className="mt-3 block overflow-x-auto rounded bg-black/40 px-3 py-2 font-mono text-[11px] text-muted">
        forge script script/DeployEquis.s.sol --rpc-url xlayer --account equis-deployer --broadcast
      </code>
      <p className="mt-2 text-[11px] text-muted">
        Then set NEXT_PUBLIC_EQUIS_VAULT and NEXT_PUBLIC_EQUIS_POOL in .env.local.
      </p>
    </section>
  );
}
