import { Navigate } from "react-router-dom";

// Legacy route — the onboarding/offboarding process now lives at /boarding.
// Equipment orders are handled separately via /orders/new.
export default function Onboarding() {
  return <Navigate to="/boarding/ny?kind=onboarding" replace />;
}
