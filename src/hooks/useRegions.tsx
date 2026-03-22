import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Region {
  id: string;
  name: string;
  sort_order: number;
}

export function useRegions() {
  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("regions")
        .select("id, name, sort_order")
        .order("sort_order");
      setRegions((data as Region[]) ?? []);
      setLoading(false);
    };
    fetch();
  }, []);

  return { regions, loading };
}
