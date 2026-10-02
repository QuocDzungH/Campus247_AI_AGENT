import type { GuidanceSource } from "@/lib/student-assistant";

export function CitationList({
  sources,
  source,
}: {
  sources?: GuidanceSource[];
  source?: GuidanceSource;
}) {
  const items = sources && sources.length > 0 ? sources : source ? [source] : [];
  if (!items.length) return null;
  return (
    <div className="space-y-2" data-testid="citation-list">
      {items.map((item, index) => (
        <details
          key={`${item.title}-${item.section}-${index}`}
          className="rounded-xl border border-slate-200 px-3 dark:border-slate-700"
          data-testid="citation-item"
        >
          <summary className="min-h-11 cursor-pointer py-2 text-xs font-medium">
            Nguồn hướng dẫn · {item.section}
          </summary>
          <p className="text-xs text-slate-500">
            {item.title === "Hướng dẫn sử dụng Campus 24/7 — bản mẫu" ? "Hướng dẫn sử dụng Campus 24/7" : item.title}
          </p>
          <blockquote className="my-3 border-l-2 border-blue-200 pl-3">{item.quote}</blockquote>
          {item.href ? (
            <a
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center text-blue-700 underline dark:text-blue-300"
            >
              Mở nguồn
            </a>
          ) : null}
        </details>
      ))}
    </div>
  );
}
