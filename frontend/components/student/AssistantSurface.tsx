"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import Link from "next/link";
import { MessageCircle, X } from "lucide-react";
import { useAssistant } from "@/lib/assistant-context";
import { AccessibleDialog } from "@/components/shared/AccessibleDialog";
import { AssistantConversation } from "./AssistantConversation";

const subscribe = (notify: () => void) => { const media = window.matchMedia("(min-width: 1024px)"); media.addEventListener("change", notify); return () => media.removeEventListener("change", notify); };
const read = () => window.matchMedia("(min-width: 1024px)").matches;

export function AssistantSurface() {
  const assistant = useAssistant();
  const { setOpen } = assistant;
  const desktop = useSyncExternalStore(subscribe, read, () => false);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);
  const close = useCallback(() => { setOpen(false); requestAnimationFrame(() => trigger.current?.focus()); }, [setOpen]);
  useEffect(() => {
    if (!assistant.open || !desktop) return;
    panel.current?.querySelector<HTMLElement>("button")?.focus();
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape" && !event.defaultPrevented && !document.querySelector('[role="dialog"][aria-modal="true"]')) { event.preventDefault(); close(); } };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [assistant.open, desktop, close]);

  const contents = <>
    <header className="flex shrink-0 items-start justify-between gap-2 border-b border-[#E7E5E4] px-4 py-3 dark:border-[#292524] bg-[#F5F5F4] dark:bg-[#1C1917]">
      <button type="button" onClick={close} aria-label="Quay lại tác vụ và đóng trợ lý" className="order-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-none hover:bg-[#E7E5E4] dark:hover:bg-[#292524] text-[#57534E] dark:text-[#A8A29E]"><X className="h-5 w-5" /></button>
      <div className="order-1"><h2 id="context-assistant-title" className="font-serif text-lg font-normal text-[#1C1917] dark:text-[#FAFAF9]">Trợ lý học vụ</h2><Link href="/student/assistant?continue=1" onClick={() => assistant.setOpen(false)} className="inline-flex min-h-11 items-center text-xs font-medium text-[#78716C] dark:text-[#A8A29E] hover:text-[#1C1917] dark:hover:text-[#FAFAF9] underline-offset-4 hover:underline">Tiếp tục trong trang chatbot →</Link></div>
    </header><AssistantConversation compact />
  </>;
  return <>
    <button ref={trigger} type="button" onClick={assistant.show} aria-expanded={assistant.open} aria-controls="context-assistant" className={`${assistant.open ? "sr-only" : "fixed bottom-4 right-4 z-30"} inline-flex min-h-12 items-center gap-2 rounded-none border border-[#78716C] bg-[#1C1917] text-[#FAFAF9] dark:bg-[#FAFAF9] dark:text-[#1C1917] dark:border-[#A8A29E] px-4 py-3 text-sm font-medium shadow-none transition-colors hover:bg-[#57534E] dark:hover:bg-[#E7E5E4]`}><MessageCircle className="h-5 w-5" />Hỏi trợ lý</button>
    {desktop ? assistant.open && <aside id="context-assistant" ref={panel} aria-labelledby="context-assistant-title" className="fixed bottom-4 right-4 top-20 z-30 flex w-[380px] flex-col border border-[#E7E5E4] bg-[#FAFAF9] shadow-none dark:border-[#292524] dark:bg-[#141210]">{contents}</aside>
      : <AccessibleDialog open={assistant.open} onClose={close} labelledBy="context-assistant-title" className="fixed inset-0 flex min-h-0 flex-col bg-[#FAFAF9] shadow-none dark:bg-[#141210] rounded-none"><div id="context-assistant" className="flex min-h-0 flex-1 flex-col">{contents}</div></AccessibleDialog>}
  </>;
}
