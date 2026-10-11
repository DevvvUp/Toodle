"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Activity, Camera, Settings } from "lucide-react";

interface MobileShellProps {
  children: React.ReactNode;
  hideTabBar?: boolean;
  wideContainer?: boolean;
}

export function MobileShell({
  children,
  hideTabBar = false,
  wideContainer = false,
}: MobileShellProps) {
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
    <div className="min-h-[100dvh] bg-[#090909] text-white flex flex-col lg:flex-row items-stretch justify-start w-full overflow-x-clip selection:bg-[#0099ff]/30">
      {/* Desktop Left Rail Navigation (>= 1024px) */}
      {!hideTabBar && (
        <aside
          aria-label="Desktop Navigation Rail"
          className="hidden lg:flex w-[72px] shrink-0 border-r border-[#262626] bg-[#090909] flex-col items-center py-6 gap-8 sticky top-0 h-[100dvh] z-40"
        >
          <Link
            href="/"
            className="w-9 h-9 relative flex items-center justify-center rounded-xl hover:bg-[#141414] transition-colors p-1"
            title="Toodle Home"
          >
            <Image
              src="/brand/toodle-logo-teal.png"
              alt="Toodle"
              width={28}
              height={28}
              className="object-contain"
              priority
            />
          </Link>

          <nav className="flex flex-col items-center gap-4 w-full">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <Link
                  key={tab.name}
                  href={tab.href}
                  className={`flex flex-col items-center justify-center w-full py-2.5 transition-colors min-h-[48px] min-w-[48px] rounded-lg ${
                    tab.isActive
                      ? "text-[#0099ff] bg-[#141414]/60"
                      : "text-[#999999] hover:text-white hover:bg-[#141414]/30"
                  }`}
                >
                  <Icon className="w-5 h-5 mb-1" />
                  <span className="text-[11px] font-medium tracking-tight">
                    {tab.name}
                  </span>
                </Link>
              );
            })}
          </nav>
        </aside>
      )}

      {/* Main Content Area */}
      <div
        className={`flex-1 flex flex-col w-full min-h-[100dvh] ${
          wideContainer ? "max-w-[1440px]" : "max-w-[720px]"
        } mx-auto relative`}
      >
        <main
          className={`flex-1 flex flex-col w-full ${
            !hideTabBar
              ? "pb-16 [@media(max-height:500px)]:pb-12 lg:pb-0"
              : ""
          }`}
        >
          {children}
        </main>

        {/* Mobile & Tablet Bottom Navigation Bar (< 1024px) */}
        {!hideTabBar && (
          <nav
            aria-label="Bottom Navigation"
            className="lg:hidden fixed bottom-0 left-0 right-0 w-full sm:max-w-[640px] sm:left-1/2 sm:-translate-x-1/2 bg-[#090909]/95 backdrop-blur-md border-t border-[#262626] z-50 flex items-center justify-around h-16 [@media(max-height:500px)]:h-12 pb-[env(safe-area-inset-bottom)]"
          >
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <Link
                  key={tab.name}
                  href={tab.href}
                  className={`flex flex-col items-center justify-center flex-1 h-full py-1 transition-colors min-h-[44px] min-w-[44px] ${
                    tab.isActive
                      ? "text-[#0099ff]"
                      : "text-[#999999] hover:text-white"
                  }`}
                >
                  <Icon className="w-5 h-5 mb-0.5 sm:mb-1" />
                  <span className="text-[11px] sm:text-[12px] font-medium tracking-[-0.12px] [@media(max-height:500px)]:hidden">
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
