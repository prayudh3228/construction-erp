import { type DepartmentId } from '@erp/shared';
import {
  BadgeCheck,
  Building,
  ClipboardList,
  HardHat,
  Landmark,
  LayoutDashboard,
  type LucideIcon,
  Scale,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Truck,
  Users,
  Warehouse,
} from 'lucide-react';

export const DEPARTMENT_ICONS: Record<DepartmentId, LucideIcon> = {
  dashboard: LayoutDashboard,
  planning: ClipboardList,
  execution: HardHat,
  purchase: ShoppingCart,
  stores: Warehouse,
  equipment: Truck,
  finance: Landmark,
  sales: Building,
  hr: Users,
  quality: BadgeCheck,
  safety: ShieldCheck,
  legal: Scale,
  admin: Settings,
};
