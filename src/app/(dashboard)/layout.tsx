import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { MobileSidebar } from "@/components/layout/mobile-sidebar";
import { StoreInitializer } from "@/components/store-initializer";
import { WhatsAppFloatButton } from "@/components/common/whatsapp-button";
import { TrialChoiceModal } from "@/components/payments/trial-choice-modal";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-full relative overflow-x-clip">
      {/* Sidebar Desktop Fixe */}
      <div className="hidden h-full md:flex md:w-72 md:flex-col md:fixed md:inset-y-0 z-[80] bg-[#1E3A5F]">
        <Sidebar />
      </div>

      {/* Menu Latéral Mobile Coulissant (déclenché par les 3 traits en haut à gauche) */}
      <MobileSidebar />

      <main className="md:pl-72 h-full min-w-0 bg-slate-50 dark:bg-[#071324] flex flex-col min-h-screen transition-colors overflow-x-clip">
        <div className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md">
          <Header />
        </div>
        <div className="p-3 sm:p-4 md:p-8 pb-32 md:pb-8 flex-1 min-w-0">{children}</div>
      </main>
      <BottomNav />
      <WhatsAppFloatButton phoneNumber="22898376101" />
      <TrialChoiceModal />
      <StoreInitializer />
    </div>
  );
}
