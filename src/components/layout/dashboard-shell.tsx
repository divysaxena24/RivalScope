"use client";

import React, { useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { AddCompetitorModal } from "@/components/competitors/add-competitor-modal";
import { X } from "lucide-react";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const isInsightsPage = pathname === "/dashboard/insights";

  return (
    <div className="h-screen h-[100dvh] flex bg-slate-50 text-slate-900 overflow-hidden">
      {/* Desktop Sidebar */}
      <div className="hidden md:block shrink-0">
        <Sidebar />
      </div>

      {/* Mobile Drawer */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="relative flex-1 max-w-xs w-full bg-white shadow-xl z-10">
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="absolute top-4 right-4 p-2 text-slate-500 hover:text-slate-700"
              aria-label="Close sidebar"
            >
              <X className="h-5 w-5" />
            </button>
            <Sidebar />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
        <Header
          onAddCompetitorClick={() => setIsModalOpen(true)}
          onMobileMenuToggle={() => setIsMobileMenuOpen(true)}
        />
        <main
          className={`flex-1 min-w-0 min-h-0 w-full ${
            isInsightsPage
              ? "p-3 sm:p-4 overflow-hidden flex flex-col"
              : "p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto overflow-y-auto"
          }`}
        >
          {children}
        </main>
      </div>

      {/* Add Competitor Modal Dialog */}
      <AddCompetitorModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}
