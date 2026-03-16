import { useEffect, useState } from "react";
import { isImpersonating, exitImpersonation } from "@/components/admin/ImpersonateUserCard";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { LogOut, Eye } from "lucide-react";

export default function ImpersonationBanner() {
  const { profile } = useAuth();
  const [active, setActive] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    setActive(isImpersonating());
  }, [profile]);

  if (!active) return null;

  const handleExit = async () => {
    setExiting(true);
    await exitImpersonation();
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-warning text-warning-foreground px-4 py-2 flex items-center justify-center gap-3 shadow-lg">
      <Eye className="h-4 w-4 shrink-0" />
      <span className="text-sm font-medium">
        Du är inloggad som <strong>{profile?.full_name || "annan användare"}</strong> (impersonation)
      </span>
      <Button
        size="sm"
        variant="outline"
        className="h-7 gap-1.5 bg-white/20 border-white/30 text-warning-foreground hover:bg-white/30"
        onClick={handleExit}
        disabled={exiting}
      >
        <LogOut className="h-3.5 w-3.5" />
        {exiting ? "Återgår..." : "Avsluta"}
      </Button>
    </div>
  );
}
