import type { IconSvgElement } from "@hugeicons/svelte";
import type { Component } from "svelte";
import type { SVGAttributes } from "svelte/elements";

import {
  Add01Icon,
  AlertCircleIcon,
  ArrowDown01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  ArrowUp01Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  DashboardSpeedIcon,
  Delete01Icon,
  Download04Icon,
  Edit01Icon,
  Loading03Icon,
  MinusSignIcon,
  Moon02Icon,
  Refresh01Icon,
  RoboticIcon,
  Settings01Icon,
  Settings02Icon,
  ShutDownIcon,
  SidebarLeftIcon,
  SunIcon,
  Tick01Icon,
  Tick02Icon,
  UnfoldMoreIcon,
  UserIcon,
} from "@hugeicons/core-free-icons";

import {
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Bot,
  Check,
  CheckCircle2,
  ChevronsUpDown,
  Download,
  Edit,
  LayoutDashboard,
  Loader2,
  Minus,
  Moon,
  Plus,
  RefreshCw,
  Settings,
  Settings2,
  Sidebar,
  Sun,
  Trash2,
  User,
  X,
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
    lucide: AlertCircle,
    hugeicons: AlertCircleIcon,
  },
  arrowDown: {
    lucide: ArrowDown,
    hugeicons: ArrowDown01Icon,
  },
  arrowLeft: {
    lucide: ArrowLeft,
    hugeicons: ArrowLeft01Icon,
  },
  arrowRight: {
    lucide: ArrowRight,
    hugeicons: ArrowRight01Icon,
  },
  arrowUp: {
    lucide: ArrowUp,
    hugeicons: ArrowUp01Icon,
  },
  agents: {
    lucide: Bot,
    hugeicons: RoboticIcon,
  },
  cancel: {
    lucide: X,
    hugeicons: Cancel01Icon,
  },
  check: {
    lucide: Check,
    hugeicons: Tick02Icon,
  },
  dashboard: {
    lucide: LayoutDashboard,
    hugeicons: DashboardSpeedIcon,
  },
  checkCircle: {
    lucide: CheckCircle2,
    hugeicons: CheckmarkCircle02Icon,
  },
  delete: {
    lucide: Trash2,
    hugeicons: Delete01Icon,
  },
  download: {
    lucide: Download,
    hugeicons: Download04Icon,
  },
  edit: {
    lucide: Edit,
    hugeicons: Edit01Icon,
  },
  loading: {
    lucide: Loader2,
    hugeicons: Loading03Icon,
  },
  minus: {
    lucide: Minus,
    hugeicons: MinusSignIcon,
  },
  refresh: {
    lucide: RefreshCw,
    hugeicons: Refresh01Icon,
  },
  settings: {
    lucide: Settings,
    hugeicons: Settings01Icon,
  },
  settings2: {
    lucide: Settings2,
    hugeicons: Settings02Icon,
  },
  shutDown: {
    lucide: X, // No exact equivalent
    hugeicons: ShutDownIcon,
  },
  sidebar: {
    lucide: Sidebar,
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
  unfoldMore: {
    lucide: ChevronsUpDown,
    hugeicons: UnfoldMoreIcon,
  },
  user: {
    lucide: User,
    hugeicons: UserIcon,
  },
};

export type IconName = keyof typeof iconRegistry;
