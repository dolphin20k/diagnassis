import {
  ArrowLeft, ArrowRight, Bell, Briefcase, Calendar, ChartColumn, ChartLine, Check, ChevronRight, CircleAlert, CircleCheck, CircleCheckBig,
  Circle, CircleHelp, ClipboardCheck, Clock, CloudOff, Compass, Crosshair, Eye, EyeOff, FileText, Gauge, Hand, History, House, Inbox, Info,
  KeyRound, Layers, LayoutDashboard, Lightbulb, ListChecks, Lock, LogIn, LogOut, MailCheck, Megaphone, Menu, MessageSquare, Minus, Pencil, Play,
  Plus, RefreshCw, Repeat, Save, ScanSearch, Search, SearchX, Settings, ShieldCheck, Sparkles, Star, Target, TrendingDown, TrendingUp, Trophy,
  Trash2, UserPlus, UserX, User, Users, WifiOff, X, ExternalLink, Download, Flag, Filter, CirclePlay, CirclePause, type LucideIcon,
} from "lucide-react";

/** Lucide outline icons, the family used by the design (stroke 2, 18px default). */
const ICONS = {
  "arrow-left": ArrowLeft, "arrow-right": ArrowRight, bell: Bell, briefcase: Briefcase, calendar: Calendar, "chart-column": ChartColumn,
  "chart-line": ChartLine, check: Check, "chevron-right": ChevronRight, "circle-alert": CircleAlert, "circle-check": CircleCheck,
  "circle-check-big": CircleCheckBig, circle: Circle, "circle-help": CircleHelp, "clipboard-check": ClipboardCheck, clock: Clock,
  "cloud-off": CloudOff, compass: Compass, crosshair: Crosshair, eye: Eye, "eye-off": EyeOff, "file-text": FileText, gauge: Gauge, hand: Hand,
  history: History, house: House, inbox: Inbox, info: Info, "key-round": KeyRound, layers: Layers, "layout-dashboard": LayoutDashboard,
  lightbulb: Lightbulb, "list-checks": ListChecks, lock: Lock, "log-in": LogIn, "log-out": LogOut, "mail-check": MailCheck, megaphone: Megaphone,
  menu: Menu, "message-square": MessageSquare, minus: Minus, pencil: Pencil, play: Play, plus: Plus, "refresh-cw": RefreshCw, repeat: Repeat,
  save: Save, "scan-search": ScanSearch, search: Search, "search-x": SearchX, settings: Settings, "shield-check": ShieldCheck, sparkles: Sparkles,
  star: Star, target: Target, "trending-down": TrendingDown, "trending-up": TrendingUp, trophy: Trophy, "trash-2": Trash2, "user-plus": UserPlus,
  "user-x": UserX, user: User, users: Users, "wifi-off": WifiOff, x: X, "external-link": ExternalLink, "circle-play": CirclePlay, "circle-pause": CirclePause, download: Download, flag: Flag, filter: Filter,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 18, className, fill, label }: { name: IconName; size?: number; className?: string; fill?: string; label?: string }) {
  const C = ICONS[name];
  return <C size={size} strokeWidth={2} className={className} fill={fill ?? "none"} aria-hidden={label ? undefined : true} aria-label={label} role={label ? "img" : undefined} />;
}
