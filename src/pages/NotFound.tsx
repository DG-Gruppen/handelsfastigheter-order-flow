import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Construction, LayoutDashboard, ShoppingCart, Headphones } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

const quickLinks = [
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { label: "Lägg en beställning", to: "/new-order", icon: ShoppingCart },
  { label: "IT-support", to: "/it-info", icon: Headphones },
];

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <motion.div
        className="text-center max-w-md w-full"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        {/* Icon */}
        <motion.div
          className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-2xl bg-primary/10"
          initial={{ scale: 0.8, rotate: -8 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ duration: 0.5, delay: 0.1, type: "spring", stiffness: 200 }}
        >
          <Construction className="h-12 w-12 text-primary" />
        </motion.div>

        {/* Heading */}
        <h1 className="text-5xl font-bold text-foreground font-heading mb-3">404</h1>
        <p className="text-lg font-medium text-foreground mb-2">
          Sidan kunde inte hittas
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed mb-8">
          Den här sidan finns inte just nu — den är troligtvis under konstruktion
          och kommer snart att bli tillgänglig.
        </p>

        {/* Quick links */}
        <div className="space-y-2 mb-6">
          {quickLinks.map((link) => (
            <Button
              key={link.to}
              variant="outline"
              className="w-full justify-start gap-3 h-12"
              asChild
            >
              <Link to={link.to}>
                <link.icon className="h-4 w-4 text-primary" />
                {link.label}
              </Link>
            </Button>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default NotFound;
