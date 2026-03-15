import { ReactNode, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "next-themes";
import { useNavSettings } from "@/hooks/useNavSettings";
import AppSidebar from "@/components/AppSidebar";

export default function AppLayout({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  const themeLoaded = useRef(false);
  const { settings } = useNavSettings();

  useEffect(() => {
    if (!themeLoaded.current) {
      const savedTheme = profile?.theme_preference;
      const defaultTheme = settings["it_default_theme"] || "light";
      if (savedTheme) {
        themeLoaded.current = true;
        setTheme(savedTheme);
      } else if (Object.keys(settings).length > 0) {
        themeLoaded.current = true;
        setTheme(defaultTheme);
      }
    }
  }, [profile?.theme_preference, settings, setTheme]);

  return (
    <div className="flex min-h-screen w-full">
      {/* Desktop Sidebar */}
      <AppSidebar />

      {/* Main content area */}
      <div className="flex-1 min-w-0 flex flex-col gradient-bg pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:pb-0 overflow-x-hidden">
        <main className={`mx-auto px-4 py-5 md:py-8 w-full ${location.pathname === "/org" ? "" : "max-w-6xl"}`}>
          {children}
        </main>
      </div>
    </div>
  );
}
