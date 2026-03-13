import { Outlet } from "react-router-dom";
import AppLayout from "@/components/AppLayout";

export default function LayoutRoute() {
  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}
