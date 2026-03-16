import { memo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getIcon } from "@/lib/icons";

interface Category { id: string; name: string; icon: string; }
interface OrderType { id: string; name: string; category_id: string | null; description: string; icon: string; }

interface Props {
  value: string;
  onChange: (value: string) => void;
  grouped: { category: Category; types: OrderType[] }[];
  uncategorized: OrderType[];
}

function EquipmentSelectBase({ value, onChange, grouped, uncategorized }: Props) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-12 md:h-10 flex-1">
        <SelectValue placeholder="Välj utrustning..." />
      </SelectTrigger>
      <SelectContent>
        {grouped.map(({ category, types }) => {
          const CatIcon = getIcon(category.icon);
          return (
            <div key={category.id}>
              <div className="px-2 py-2 text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <CatIcon className="h-3.5 w-3.5" />
                {category.name}
              </div>
              {types.map((t) => (
                <SelectItem key={t.id} value={t.id} className="py-3 md:py-2">
                  {t.name}
                </SelectItem>
              ))}
            </div>
          );
        })}
        {uncategorized.length > 0 && (
          <div>
            <div className="px-2 py-2 text-xs font-semibold text-muted-foreground">Övrigt</div>
            {uncategorized.map((t) => (
              <SelectItem key={t.id} value={t.id} className="py-3 md:py-2">
                {t.name}
              </SelectItem>
            ))}
          </div>
        )}
      </SelectContent>
    </Select>
  );
}

const EquipmentSelect = memo(EquipmentSelectBase);
export default EquipmentSelect;
