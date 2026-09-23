'use client';

import React from 'react';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  elevated?: boolean;
  hoverable?: boolean;
  specular?: boolean;
  onClick?: () => void;
}

export function GlassCard({
  children,
  className = '',
  elevated = false,
  hoverable = false,
  specular = true,
  onClick,
}: GlassCardProps) {
  const panelClass = elevated ? 'glass-panel-elevated' : 'glass-panel';
  const specularClass = specular ? 'glass-specular-edge' : '';
  const hoverClasses = hoverable
    ? 'transition-all duration-300 ease-out hover:-translate-y-1 hover:border-white/25 hover:shadow-[0_20px_40px_rgba(0,0,0,0.65)] cursor-pointer active:scale-[0.99]'
    : '';

  return (
    <div
      onClick={onClick}
      className={`rounded-2xl relative overflow-hidden glass-grain ${panelClass} ${specularClass} ${hoverClasses} ${className}`}
    >
      {/* Top specular light line */}
      <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-white/25 to-transparent pointer-events-none z-10" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
