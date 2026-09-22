import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-full relative">
      <div className="hidden h-full md:flex md:w-72 md:flex-col md:fixed md:inset-y-0 z-[80] bg-[#1E3A5F]">
        <Sidebar />
      </div>
      <main className="md:pl-72 h-full bg-slate-50">
        <div className="h-[80px]">
          <Header />
        </div>
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
