import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { MobileSidebar } from "@/components/layout/mobile-sidebar";
import { StoreInitializer } from "@/components/store-initializer";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-full relative">
      {/* Sidebar Desktop Fixe */}
      <div className="hidden h-full md:flex md:w-72 md:flex-col md:fixed md:inset-y-0 z-[80] bg-[#1E3A5F]">
        <Sidebar />
      </div>

      {/* Menu Latéral Mobile Coulissant (déclenché par les 3 traits en haut à gauche) */}
      <MobileSidebar />

      <main className="md:pl-72 h-full bg-slate-50 flex flex-col min-h-screen">
        <div className="h-[70px] md:h-[80px] shrink-0 sticky top-0 z-[40] bg-slate-50/80 backdrop-blur-sm">
          <Header />
        </div>
        <div className="p-4 md:p-8 pb-24 md:pb-8 flex-1">{children}</div>
      </main>
      <BottomNav />
      <StoreInitializer />
    </div>
  );
}
