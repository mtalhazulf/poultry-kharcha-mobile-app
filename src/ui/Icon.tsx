/**
 * Lucide line icons by kebab-case key. Only the icons listed here ship with
 * the app; add new keys explicitly. Unknown keys render `package`.
 *
 * lucide-react-native 1.x renamed a few icons; the current names are the
 * canonical keys and the old names stay as aliases:
 * filter -> funnel, fingerprint -> fingerprint-pattern,
 * building-2 -> building-complex, trash-2 -> trash, circle-help -> circle-question-mark.
 */
import {
  Archive,
  ArrowLeftRight,
  Ban,
  Banknote,
  Bird,
  BuildingComplex,
  Calendar,
  Camera,
  ChartColumn,
  ChartPie,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleAlert,
  CircleCheck,
  CirclePlus,
  CircleQuestionMark,
  Clock,
  Copy,
  Crown,
  Droplets,
  Egg,
  Ellipsis,
  Eye,
  EyeOff,
  FileText,
  FingerprintPattern,
  Flame,
  Fuel,
  Funnel,
  Grid2x2,
  Hammer,
  HardHat,
  Hourglass,
  House,
  Image as ImageIcon,
  Info,
  KeyRound,
  Layers,
  List,
  Lock,
  LogIn,
  LogOut,
  Mail,
  Package,
  Paperclip,
  Pencil,
  Phone,
  Pill,
  Plus,
  Receipt,
  RefreshCw,
  ScanFace,
  Search,
  Send,
  Settings,
  Share2,
  Shield,
  ShieldCheck,
  ShoppingCart,
  SlidersHorizontal,
  SprayCan,
  Syringe,
  Trash,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  Truck,
  User,
  UserCheck,
  UserPlus,
  Users,
  UserX,
  Warehouse,
  Wheat,
  Wifi,
  WifiOff,
  Wrench,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react-native';
import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { colors, layout } from '../theme';

const ICONS = {
  // Expense type picker (docs/ARCHITECTURE.md §2)
  wheat: Wheat,
  egg: Egg,
  bird: Bird,
  pill: Pill,
  syringe: Syringe,
  'hard-hat': HardHat,
  users: Users,
  zap: Zap,
  droplets: Droplets,
  flame: Flame,
  fuel: Fuel,
  truck: Truck,
  wrench: Wrench,
  hammer: Hammer,
  layers: Layers,
  warehouse: Warehouse,
  house: House,
  'spray-can': SprayCan,
  'shopping-cart': ShoppingCart,
  receipt: Receipt,
  banknote: Banknote,
  phone: Phone,
  wifi: Wifi,
  package: Package,

  // Navigation and actions
  'chart-column': ChartColumn,
  'chart-pie': ChartPie,
  settings: Settings,
  plus: Plus,
  'circle-plus': CirclePlus,
  search: Search,
  'sliders-horizontal': SlidersHorizontal,
  funnel: Funnel,
  'chevron-right': ChevronRight,
  'chevron-left': ChevronLeft,
  'chevron-down': ChevronDown,
  'chevron-up': ChevronUp,
  x: X,
  check: Check,
  pencil: Pencil,
  trash: Trash,
  copy: Copy,
  'share-2': Share2,
  'refresh-cw': RefreshCw,
  send: Send,
  archive: Archive,
  ellipsis: Ellipsis,
  list: List,
  'grid-2x2': Grid2x2,
  'arrow-left-right': ArrowLeftRight,

  // Status and feedback
  'circle-check': CircleCheck,
  'circle-alert': CircleAlert,
  'triangle-alert': TriangleAlert,
  info: Info,
  'circle-question-mark': CircleQuestionMark,
  ban: Ban,
  'wifi-off': WifiOff,
  clock: Clock,
  hourglass: Hourglass,
  'trending-up': TrendingUp,
  'trending-down': TrendingDown,

  // Account, security, organization
  lock: Lock,
  'fingerprint-pattern': FingerprintPattern,
  'scan-face': ScanFace,
  'key-round': KeyRound,
  shield: Shield,
  'shield-check': ShieldCheck,
  eye: Eye,
  'eye-off': EyeOff,
  mail: Mail,
  'log-in': LogIn,
  'log-out': LogOut,
  'building-complex': BuildingComplex,
  crown: Crown,
  user: User,
  'user-plus': UserPlus,
  'user-check': UserCheck,
  'user-x': UserX,

  // Receipts and dates
  camera: Camera,
  image: ImageIcon,
  paperclip: Paperclip,
  'file-text': FileText,
  calendar: Calendar,

  // Aliases for pre-1.0 lucide names
  filter: Funnel,
  fingerprint: FingerprintPattern,
  'building-2': BuildingComplex,
  'trash-2': Trash,
  'circle-help': CircleQuestionMark,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

export const ICON_NAMES = Object.keys(ICONS) as IconName[];

export function isIconName(value: unknown): value is IconName {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(ICONS, value);
}

export interface IconProps {
  name: IconName;
  /** 16 / 20 / 24 (layout.icon). Default 20. */
  size?: number;
  /** Default colors.textSecondary. */
  color?: string;
  /** Default 2. */
  strokeWidth?: number;
  /** Set only for meaningful icons; decorative icons stay hidden from screen readers. */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const Icon = React.memo(function IconBase({
  name,
  size = layout.icon.md,
  color = colors.textSecondary,
  strokeWidth = layout.iconStroke,
  accessibilityLabel,
  style,
  testID,
}: IconProps) {
  const Glyph: LucideIcon = isIconName(name) ? ICONS[name] : Package;
  if (accessibilityLabel) {
    return (
      <Glyph
        size={size}
        color={color}
        strokeWidth={strokeWidth}
        style={style}
        testID={testID}
        accessible
        accessibilityRole="image"
        accessibilityLabel={accessibilityLabel}
      />
    );
  }
  return (
    <Glyph
      size={size}
      color={color}
      strokeWidth={strokeWidth}
      style={style}
      testID={testID}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
});
