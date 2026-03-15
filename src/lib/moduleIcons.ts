import {
  Home, Plus, UserPlus, History, Headphones, Building2, Settings,
  Target, Newspaper, Building, Users, FolderOpen, BookOpen,
  Heart, BarChart3, User, LayoutGrid, Monitor, Package,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const moduleIconMap: Record<string, LucideIcon> = {
  home: Home,
  plus: Plus,
  "user-plus": UserPlus,
  history: History,
  headphones: Headphones,
  "building-2": Building2,
  settings: Settings,
  target: Target,
  newspaper: Newspaper,
  building: Building,
  users: Users,
  "folder-open": FolderOpen,
  "book-open": BookOpen,
  heart: Heart,
  "bar-chart-3": BarChart3,
  user: User,
  "layout-grid": LayoutGrid,
  monitor: Monitor,
};

export function getModuleIcon(name: string): LucideIcon {
  return moduleIconMap[name] ?? Package;
}
