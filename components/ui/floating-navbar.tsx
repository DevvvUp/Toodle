"use client";
import React, { useEffect, useState } from "react";
import { motion, useScroll, useSpring } from "framer-motion";
import { cn } from "@/lib/utils";
import Link from "next/link";
import Image from "next/image";
import { Search, Menu, X } from "lucide-react";

export const FloatingNav = ({
  navItems,
  className,
}: {
  navItems: {
    name: string;
    link: string;
    icon?: JSX.Element;
  }[];
  className?: string;
}) => {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30, restDelta: 0.001 });
  const [activeSection, setActiveSection] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const sections = navItems.map(item => item.link.replace('#', ''));
      let current = "";
      for (const section of sections) {
        const el = document.getElementById(section);
        if (el && window.scrollY >= (el.offsetTop - 150)) {
          current = section;
        }
      }
      setActiveSection(current);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [navItems]);

  return (
    <>
      <motion.div
        className="fixed top-0 left-0 right-0 h-1 bg-cyan-400 origin-left z-[5001]"
        style={{ scaleX }}
      />
      <header
        className={cn(
          "fixed top-0 inset-x-0 h-16 bg-black/60 backdrop-blur-xl border-b border-white/10 z-[5000] flex items-center transition-colors",
          className
        )}
      >
        <div className="max-w-7xl mx-auto px-6 lg:px-8 w-full flex items-center h-full">
          {/* Left: Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <Image src="/brand/toodle-logo-white.png" alt="Toodle" width={24} height={24} className="w-6 h-6 object-contain" />
            <span className="text-lg font-semibold tracking-tight text-white ml-2">Toodle</span>
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden lg:flex items-center ml-10 gap-7 h-full">
            {navItems.map((navItem, idx) => {
              const isActive = activeSection === navItem.link.replace('#', '');
              return (
                <Link
                  key={`link=${idx}`}
                  href={navItem.link}
                  className={cn(
                    "text-sm font-medium transition-colors duration-150 h-full flex items-center relative",
                    isActive ? "text-white" : "text-neutral-300 hover:text-white"
                  )}
                >
                  {navItem.name}
                  {isActive && (
                    <motion.div layoutId="active-nav" className="absolute bottom-0 left-0 right-0 h-[2px] bg-cyan-400 rounded-t-full" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Right: Actions */}
          <div className="ml-auto hidden lg:flex items-center gap-3">
            <button className="h-9 px-3 rounded-lg border border-white/10 bg-white/5 flex items-center gap-2 text-neutral-400 hover:text-white hover:bg-white/10 transition-colors">
              <Search className="w-4 h-4" />
              <span className="text-sm">Search...</span>
              <kbd className="ml-2 text-[10px] font-sans px-1.5 py-0.5 rounded-md bg-neutral-900 border border-neutral-700">⌘K</kbd>
            </button>
            <Link href="/demo" className="text-sm font-medium text-neutral-300 hover:text-white px-3">
              Demo
            </Link>
            <Link 
              href="/command-center" 
              className="h-10 px-4 rounded-xl bg-white text-neutral-950 text-sm font-medium inline-flex items-center justify-center transition-all hover:bg-neutral-100 hover:-translate-y-px active:scale-[0.98] ring-1 ring-white/40 ring-offset-2 ring-offset-black focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              Launch Command Center
            </Link>
          </div>

          {/* Mobile Menu Toggle */}
          <button className="lg:hidden ml-auto p-2 text-neutral-300" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </header>

      {menuOpen && (
        <div className="fixed inset-0 z-[4999] bg-black/95 backdrop-blur-3xl pt-20 px-6 flex flex-col gap-6 lg:hidden overflow-y-auto pb-10">
          {navItems.map((item, idx) => (
            <Link 
              key={idx} 
              href={item.link} 
              className="text-2xl font-medium text-neutral-300 active:text-white py-2"
              onClick={() => setMenuOpen(false)}
            >
              {item.name}
            </Link>
          ))}
          <div className="mt-8 flex flex-col gap-4">
            <Link href="/demo" className="text-lg text-neutral-300" onClick={() => setMenuOpen(false)}>Demo</Link>
            <Link 
              href="/command-center" 
              className="h-12 w-full rounded-xl bg-white text-neutral-950 text-lg font-medium inline-flex items-center justify-center mt-4 ring-1 ring-white/40"
              onClick={() => setMenuOpen(false)}
            >
              Launch Command Center
            </Link>
          </div>
        </div>
      )}
    </>
  );
};