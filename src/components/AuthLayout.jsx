import React from 'react';

export default function AuthLayout({
  icon: Icon,
  title,
  subtitle,
  footer,
  children,
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#121417] text-white px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#2a2f37] border border-[#3a4a3a] mb-4">
            <Icon className="w-7 h-7 text-emerald-400" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">{title}</h1>
          {subtitle && <p className="text-slate-400 text-sm mt-2">{subtitle}</p>}
        </div>
        <div className="bg-[#1e2227] rounded-2xl shadow-xl border border-[#2a2f37] p-6 sm:p-8">
          {children}
        </div>
        {footer && (
          <p className="text-center text-sm text-slate-400 mt-6">{footer}</p>
        )}
      </div>
    </div>
  );
}
