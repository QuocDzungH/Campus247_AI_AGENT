import React from "react";
import { FileQuestion, type LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon: Icon = FileQuestion, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center bg-[#FAFAF9] dark:bg-[#1C1917] border border-[#E7E5E4] dark:border-[#292524] rounded-none">
      <div className="w-12 h-12 bg-[#F5F5F4] dark:bg-[#23201D] border border-[#E7E5E4] dark:border-[#292524] rounded-none flex items-center justify-center mb-4">
        <Icon className="w-6 h-6 text-[#78716C] dark:text-[#A8A29E]" />
      </div>
      <h3 className="font-serif text-lg font-normal text-[#1C1917] dark:text-[#FAFAF9] mb-1">{title}</h3>
      <p className="text-sm text-[#57534E] dark:text-[#D6D3D1] max-w-sm mb-6">{description}</p>
      {action && <div>{action}</div>}
    </div>
  );
}
