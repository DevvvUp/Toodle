"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Camera, Settings } from "lucide-react";

interface MobileShellProps {
  children: React.ReactNode;
  hideTabBar?: boolean;
}

export function MobileShell({ children, hideTabBar = false }: MobileShellProps) {
  const pathname = usePathname();

  const tabs = [
    {
      name: "Command",
      href: "/command-center",
      icon: Activity,
      isActive: pathname.startsWith("/command-center") || pathname === "/dashboard",
    },
    {
      name: "Demo",
      href: "/demo",
      icon: Camera,
      isActive: pathname.startsWith("/demo"),
    },
    {
      name: "Settings",
      href: "/settings",
      icon: Settings,
      isActive: pathname.startsWith("/settings"),
    },
  ];

  return (
    <div className="min-h-[100dvh] bg-[#090909] text-white flex flex-col items-center justify-start selection:bg-[#0099ff]/30">
      <div className="w-full max-w-[480px] min-h-[100dvh] bg-[#090909] flex flex-col relative border-x border-[#262626]/40 shadow-2xl">
        <main className={`flex-1 flex flex-col ${!hideTabBar ? "pb-20" : ""}`}>
          {children}
        </main>

        {!hideTabBar && (
          <nav
            aria-label="Bottom Navigation"
            className="fixed bottom-0 w-full max-w-[480px] bg-[#090909]/95 backdrop-blur-md border-t border-[#262626] z-50 flex items-center justify-around h-16 pb-[env(safe-area-inset-bottom)]"
          >
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <Link
                  key={tab.name}
                  href={tab.href}
                  className={`flex flex-col items-center justify-center flex-1 h-full py-1 transition-colors ${
                    tab.isActive
                      ? "text-[#0099ff]"
                      : "text-[#999999] hover:text-white"
                  }`}
                >
                  <Icon className="w-5 h-5 mb-1" />
                  <span className="text-[12px] font-medium tracking-[-0.12px]">
                    {tab.name}
                  </span>
                </Link>
              );
            })}
          </nav>
        )}
      </div>
    </div>
  );
}
