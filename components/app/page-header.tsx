export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
      <div className="max-w-3xl">
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--tertiary)]">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-3 font-display text-4xl font-extrabold tracking-[-0.06em] text-[var(--foreground)] sm:text-5xl">
          {title}
        </h1>
        <p className="mt-4 text-base leading-8 text-[var(--foreground-soft)]">
          {description}
        </p>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </div>
  );
}
