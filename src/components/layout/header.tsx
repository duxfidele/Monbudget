import { User, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export const Header = () => {
  return (
    <div className="flex items-center justify-between p-4 border-b h-full">
      <div className="md:hidden flex items-center">
        <Link href="/" className="flex items-center">
          <div className="relative w-8 h-8 mr-2 flex items-center justify-center bg-[#1E3A5F] rounded-full">
            <span className="text-white font-bold text-lg">M</span>
          </div>
          <h1 className="text-xl font-bold text-[#1E3A5F]">MonBudget</h1>
        </Link>
      </div>
      
      <div className="flex w-full justify-end gap-2">
        <Button variant="ghost" size="icon" className="rounded-full md:hidden text-slate-500">
          <Menu className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" className="rounded-full">
          <User className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
};
