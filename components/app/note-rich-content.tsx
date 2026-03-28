import { formatNote } from "@/lib/note-format";
import type { NoteRead } from "@/lib/types";

export function NoteRichContent({ note }: { note: NoteRead }) {
  const formatted = formatNote(note);

  return (
    <div className="space-y-6">
      {formatted.sections.map((section) => (
        <article
          key={section.id}
          className="rounded-[20px] border border-[rgba(194,200,190,0.38)] bg-[linear-gradient(180deg,rgba(133,165,121,0.08),rgba(255,255,255,0.96))] p-6"
        >
          <div className="flex items-start gap-4">
            {section.index ? (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[rgba(73,102,64,0.12)] font-display text-sm font-bold text-[var(--primary)]">
                {section.index}
              </div>
            ) : null}
            <div className="min-w-0 flex-1 space-y-4">
              <h3 className="font-display text-[26px] font-bold tracking-[-0.04em] text-[var(--foreground)]">
                {section.title}
              </h3>
              {section.paragraphs.map((paragraph) => (
                <p
                  key={`${section.id}-${paragraph.slice(0, 32)}`}
                  className="text-[15px] leading-8 text-[var(--muted-foreground)]"
                >
                  {paragraph}
                </p>
              ))}
              {section.bullets.length > 0 ? (
                <ul className="space-y-3">
                  {section.bullets.map((bullet) => (
                    <li
                      key={`${section.id}-${bullet.slice(0, 24)}`}
                      className="flex items-start gap-3 text-[15px] leading-7 text-[var(--muted-foreground)]"
                    >
                      <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[var(--primary-soft)]" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        </article>
      ))}

      {formatted.blocks.map((block) => {
        if (block.type === "list") {
          return (
            <div
              key={block.id}
              className="rounded-[20px] border border-[var(--border-soft)] bg-[var(--panel-soft)] p-6"
            >
              <ul className="space-y-3">
                {block.items.map((item) => (
                  <li
                    key={`${block.id}-${item.slice(0, 24)}`}
                    className="flex items-start gap-3 text-[15px] leading-7 text-[var(--muted-foreground)]"
                  >
                    <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[var(--accent-warm)]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        }

        return (
          <div
            key={block.id}
            className="rounded-[20px] border border-[var(--border-soft)] bg-white p-6 text-[15px] leading-8 text-[var(--muted-foreground)] shadow-[0_8px_24px_rgba(28,27,27,0.04)]"
          >
            {block.text}
          </div>
        );
      })}
    </div>
  );
}
