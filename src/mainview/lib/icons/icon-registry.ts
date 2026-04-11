import type { IconSvgElement } from "@hugeicons/svelte";
import type { Component } from "svelte";
import type { SVGAttributes } from "svelte/elements";

import {
  Add01Icon,
  AlertCircleIcon,
  CheckmarkCircle02Icon,
  ChevronLeft,
  DashboardSpeedIcon,
  Delete01Icon,
  Download04Icon,
  Edit01Icon,
  Loading03Icon,
  Moon02Icon,
  Refresh01Icon,
  RoboticIcon,
  Settings01Icon,
  ShutDownIcon,
  SidebarLeftIcon,
  SunIcon,
  Tick01Icon,
} from "@hugeicons/core-free-icons";

import {
  ArrowDown10Icon,
  ArrowDownZAIcon,
  ArrowRight,
  ArrowUp01Icon,
  ArrowUpAZIcon,
  Bot,
  ChartColumn,
  Check,
  ChevronLeftIcon,
  CircleAlert,
  CircleCheck,
  Cog,
  Download,
  LayoutDashboard,
  Loader,
  LogOut,
  Moon,
  PanelLeft,
  Plus,
  RefreshCw,
  SquarePen,
  Sun,
  TrashIcon,
  TriangleAlert,
  WifiOff,
} from "@lucide/svelte";

interface LucideIconProps extends SVGAttributes<SVGSVGElement> {
  size?: string | number;
  color?: string;
  strokeWidth?: string | number;
  ariaLabel?: string;
  class?: string;
  role?: string;
  name?: string;
  stroke?: string;
}

type LucideIcon = Component<LucideIconProps>;
type HugeIconsIcon = IconSvgElement;

type IconEntry = {
  lucide?: LucideIcon;
  hugeicons?: HugeIconsIcon;
};

export const iconRegistry: Record<string, IconEntry> = {
  add: {
    lucide: Plus,
    hugeicons: Add01Icon,
  },
  alertCircle: {
    lucide: CircleAlert,
    hugeicons: AlertCircleIcon,
  },
  alertTriangle: {
    lucide: TriangleAlert,
  },
  agents: {
    lucide: Bot,
    hugeicons: RoboticIcon,
  },
  arrowDownChar: {
    lucide: ArrowDownZAIcon,
  },
  arrowUpChar: {
    lucide: ArrowUpAZIcon,
  },
  arrowDownNumeric: {
    lucide: ArrowDown10Icon,
  },
  arrowUpNumeric: {
    lucide: ArrowUp01Icon,
  },
  arrowRight: {
    lucide: ArrowRight,
  },
  chevronLeft: {
    lucide: ChevronLeftIcon,
    hugeicons: ChevronLeft,
  },
  dashboard: {
    lucide: LayoutDashboard,
    hugeicons: DashboardSpeedIcon,
  },
  checkCircle: {
    lucide: CircleCheck,
    hugeicons: CheckmarkCircle02Icon,
  },
  delete: {
    lucide: TrashIcon,
    hugeicons: Delete01Icon,
  },
  download: {
    lucide: Download,
    hugeicons: Download04Icon,
  },
  edit: {
    lucide: SquarePen,
    hugeicons: Edit01Icon,
  },
  loading: {
    lucide: Loader,
    hugeicons: Loading03Icon,
  },
  refresh: {
    lucide: RefreshCw,
    hugeicons: Refresh01Icon,
  },
  settings: {
    lucide: Cog,
    hugeicons: Settings01Icon,
  },
  shutDown: {
    lucide: LogOut,
    hugeicons: ShutDownIcon,
  },
  sidebar: {
    lucide: PanelLeft,
    hugeicons: SidebarLeftIcon,
  },
  sun: {
    lucide: Sun,
    hugeicons: SunIcon,
  },
  moon: {
    lucide: Moon,
    hugeicons: Moon02Icon,
  },
  tick: {
    lucide: Check,
    hugeicons: Tick01Icon,
  },
  barChart: {
    lucide: ChartColumn,
  },
  wifiOff: {
    lucide: WifiOff,
  },
};

export type IconName = keyof typeof iconRegistry;
