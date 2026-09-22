import { User } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Header = () => {
  return (
    <div className="flex items-center p-4 border-b h-full">
      <div className="flex w-full justify-end">
        <Button variant="ghost" size="icon" className="rounded-full">
          <User className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
};
