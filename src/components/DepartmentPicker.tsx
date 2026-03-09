import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface Department {
  id: string;
  name: string;
}

interface DepartmentPickerProps {
  departments: Department[];
  selected: string[];
  onChange: (ids: string[]) => void;
}

export default function DepartmentPicker({ departments, selected, onChange }: DepartmentPickerProps) {
  const allSelected = departments.length > 0 && selected.length === departments.length;

  const toggleAll = () => {
    onChange(allSelected ? [] : departments.map((d) => d.id));
  };

  const toggle = (id: string) => {
    onChange(
      selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]
    );
  };

  if (departments.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">Inga avdelningar skapade ännu</p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 pb-1 border-b border-border/40 mb-1">
        <Checkbox
          id="dept-all"
          checked={allSelected}
          onCheckedChange={toggleAll}
        />
        <Label htmlFor="dept-all" className="text-xs font-medium cursor-pointer">
          Alla avdelningar
        </Label>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 max-h-36 overflow-y-auto">
        {departments.map((d) => (
          <div key={d.id} className="flex items-center gap-2">
            <Checkbox
              id={`dept-${d.id}`}
              checked={selected.includes(d.id)}
              onCheckedChange={() => toggle(d.id)}
            />
            <Label htmlFor={`dept-${d.id}`} className="text-xs cursor-pointer truncate">
              {d.name}
            </Label>
          </div>
        ))}
      </div>
    </div>
  );
}
