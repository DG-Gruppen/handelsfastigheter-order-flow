import { Suspense } from "react";
import { Outlet } from "react-router-dom";
import AppLayout from "@/components/AppLayout";

const PageFallback = () => (
  <div className="flex items-center justify-center min-h-[50vh]">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
  </div>
);

export default function LayoutRoute() {
  return (
    <AppLayout>
      <Suspense fallback={<PageFallback />}>
        <Outlet />
      </Suspense>
    </AppLayout>
  );
}
