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
          className="rounded-none border border-[#E7E5E4] px-3 dark:border-[#292524]"
          data-testid="citation-item"
        >
          <summary className="min-h-11 cursor-pointer py-2 text-xs font-semibold text-[#1C1917] dark:text-[#FAFAF9]">
            Nguồn hướng dẫn · {item.section}
          </summary>
          <p className="text-xs text-[#57534E] dark:text-[#D6D3D1]">
            {item.title === "Hướng dẫn sử dụng Campus 24/7 — bản mẫu" ? "Hướng dẫn sử dụng Campus 24/7" : item.title}
          </p>
          {item.documentId ? (
            <p className="text-xs text-[#78716C] dark:text-[#A8A29E]" data-testid="citation-provenance">
              {item.documentId}
              {item.documentVersion ? ` · ${item.documentVersion}` : ""}
              {item.chunkId ? ` · ${item.chunkId}` : ""}
            </p>
          ) : null}
          <blockquote className="my-3 border-l-2 border-[#78716C] pl-3 text-xs text-[#57534E] dark:border-[#A8A29E] dark:text-[#D6D3D1]">{item.quote}</blockquote>
          {item.href ? (
            <a
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center text-[#78716C] underline hover:text-[#57534E] dark:text-[#A8A29E] dark:hover:text-[#FAFAF9]"
            >
              Mở nguồn
            </a>
          ) : null}
        </details>
      ))}
    </div>
  );
}
