import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, X, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Profile {
  user_id: string;
  full_name: string;
}

export interface PlannerFilterState {
  search: string;
  priority: string;
  assignee: string;
  label: string;
}

interface Props {
  filters: PlannerFilterState;
  onChange: (filters: PlannerFilterState) => void;
  profiles: Profile[];
  availableLabels: string[];
}

const EMPTY_FILTERS: PlannerFilterState = {
  search: "",
  priority: "",
  assignee: "",
  label: "",
};

export default function PlannerFilters({ filters, onChange, profiles, availableLabels }: Props) {
  const hasActiveFilters = filters.search || filters.priority || filters.assignee || filters.label;

  const update = (patch: Partial<PlannerFilterState>) => {
    onChange({ ...filters, ...patch });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Search */}
      <div className="relative flex-1 min-w-[180px] max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={filters.search}
          onChange={e => update({ search: e.target.value })}
          placeholder="Sök kort..."
          className="pl-8 h-9 text-sm"
        />
        {filters.search && (
          <button
            onClick={() => update({ search: "" })}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted"
          >
            <X className="h-3 w-3 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Priority filter */}
      <Select value={filters.priority} onValueChange={v => update({ priority: v === "all" ? "" : v })}>
        <SelectTrigger className="w-[130px] h-9 text-sm">
          <SelectValue placeholder="Prioritet" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Alla prioriteter</SelectItem>
          <SelectItem value="urgent">Brådskande</SelectItem>
          <SelectItem value="high">Hög</SelectItem>
          <SelectItem value="medium">Medium</SelectItem>
          <SelectItem value="low">Låg</SelectItem>
        </SelectContent>
      </Select>

      {/* Assignee filter */}
      <Select value={filters.assignee} onValueChange={v => update({ assignee: v === "all" ? "" : v })}>
        <SelectTrigger className="w-[150px] h-9 text-sm">
          <SelectValue placeholder="Tilldelad" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Alla personer</SelectItem>
          <SelectItem value="unassigned">Ej tilldelad</SelectItem>
          {profiles.map(p => (
            <SelectItem key={p.user_id} value={p.user_id}>{p.full_name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Label filter */}
      {availableLabels.length > 0 && (
        <Select value={filters.label} onValueChange={v => update({ label: v === "all" ? "" : v })}>
          <SelectTrigger className="w-[130px] h-9 text-sm">
            <SelectValue placeholder="Etikett" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alla etiketter</SelectItem>
            {availableLabels.map(l => (
              <SelectItem key={l} value={l}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Clear all */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="h-9 gap-1.5 text-muted-foreground hover:text-foreground"
          onClick={() => onChange(EMPTY_FILTERS)}
        >
          <X className="h-3.5 w-3.5" />
          Rensa filter
        </Button>
      )}
    </div>
  );
}

export { EMPTY_FILTERS };
