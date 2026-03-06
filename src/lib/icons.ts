import {
  Laptop,
  Smartphone,
  Monitor,
  Keyboard,
  Mouse,
  Headphones,
  Package,
  Wifi,
  Printer,
  HardDrive,
  Usb,
  Tablet,
  Watch,
  Camera,
  Speaker,
  Cable,
  Armchair,
  Key,
  CreditCard,
  Briefcase,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const iconMap: Record<string, LucideIcon> = {
  laptop: Laptop,
  smartphone: Smartphone,
  monitor: Monitor,
  keyboard: Keyboard,
  mouse: Mouse,
  headphones: Headphones,
  package: Package,
  wifi: Wifi,
  printer: Printer,
  "hard-drive": HardDrive,
  usb: Usb,
  tablet: Tablet,
  watch: Watch,
  camera: Camera,
  speaker: Speaker,
  cable: Cable,
  armchair: Armchair,
  key: Key,
  "credit-card": CreditCard,
  briefcase: Briefcase,
};

export const iconOptions = Object.keys(iconMap);

export function getIcon(name: string): LucideIcon {
  return iconMap[name] ?? Package;
}
