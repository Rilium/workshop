import type { LucideIcon, LucideProps } from "lucide-react";
import {
  AlertCircle as AlertCircleIcon,
  AlertTriangle as AlertTriangleIcon,
  Archive as ArchiveIcon,
  ArrowRight as ArrowRightIcon,
  BadgeCheck as BadgeCheckIcon,
  Banknote as BanknoteIcon,
  Bell as BellIcon,
  BellRing as BellRingIcon,
  BookOpen as BookOpenIcon,
  BriefcaseBusiness as BriefcaseBusinessIcon,
  CalendarCheck as CalendarCheckIcon,
  Check as CheckIcon,
  CheckCheck as CheckCheckIcon,
  ChevronDown as ChevronDownIcon,
  ChevronLeft as ChevronLeftIcon,
  CircleDollarSign as CircleDollarSignIcon,
  ClipboardCheck as ClipboardCheckIcon,
  Clock3 as Clock3Icon,
  ExternalLink as ExternalLinkIcon,
  FileCheck2 as FileCheck2Icon,
  FolderKanban as FolderKanbanIcon,
  History as HistoryIcon,
  Info as InfoIconGlyph,
  Loader2 as Loader2Icon,
  LogIn as LogInIcon,
  LogOut as LogOutIcon,
  Mail as MailIcon,
  Megaphone as MegaphoneIcon,
  Menu as MenuIcon,
  Moon as MoonIcon,
  Palette as PaletteIcon,
  Plus as PlusIcon,
  Presentation as PresentationIcon,
  RefreshCw as RefreshCwIcon,
  RotateCcw as RotateCcwIcon,
  Search as SearchIcon,
  Send as SendIcon,
  Settings2 as Settings2Icon,
  Share2 as Share2Icon,
  ShieldCheck as ShieldCheckIcon,
  SlidersHorizontal as SlidersHorizontalIcon,
  Sparkles as SparklesIcon,
  Sun as SunIcon,
  Trash2 as Trash2Icon,
  UploadCloud as UploadCloudIcon,
  UsersRound as UsersRoundIcon,
  Video as VideoIcon,
  X as XIcon,
} from "lucide-react";

type FaStyle = "duotone" | "light" | "regular" | "solid";

type FaIconProps = LucideProps & {
  spin?: boolean;
  styleType?: FaStyle;
};

function kebabName(name: string) {
  return name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

function makeIcon(exportName: string, Icon: LucideIcon) {
  return function LocalIcon({
    className = "",
    spin,
    styleType: _styleType,
    "aria-hidden": ariaHidden,
    ...props
  }: FaIconProps) {
    const legacyName = kebabName(exportName);
    const iconClassName = [
      "fa-icon",
      `lucide-${legacyName}`,
      spin ? "fa-spin" : "",
      className,
    ].filter(Boolean).join(" ");

    return (
      <Icon
        {...props}
        className={iconClassName}
        data-lucide={legacyName}
        aria-hidden={ariaHidden ?? true}
      />
    );
  };
}

export const AlertCircle = makeIcon("AlertCircle", AlertCircleIcon);
export const AlertTriangle = makeIcon("AlertTriangle", AlertTriangleIcon);
export const Archive = makeIcon("Archive", ArchiveIcon);
export const ArrowRight = makeIcon("ArrowRight", ArrowRightIcon);
export const BadgeCheck = makeIcon("BadgeCheck", BadgeCheckIcon);
export const Banknote = makeIcon("Banknote", BanknoteIcon);
export const Bell = makeIcon("Bell", BellIcon);
export const BellRing = makeIcon("BellRing", BellRingIcon);
export const BookOpen = makeIcon("BookOpen", BookOpenIcon);
export const BriefcaseBusiness = makeIcon("BriefcaseBusiness", BriefcaseBusinessIcon);
export const CalendarCheck = makeIcon("CalendarCheck", CalendarCheckIcon);
export const Check = makeIcon("Check", CheckIcon);
export const CheckCheck = makeIcon("CheckCheck", CheckCheckIcon);
export const ChevronDown = makeIcon("ChevronDown", ChevronDownIcon);
export const ChevronLeft = makeIcon("ChevronLeft", ChevronLeftIcon);
export const CircleDollarSign = makeIcon("CircleDollarSign", CircleDollarSignIcon);
export const ClipboardCheck = makeIcon("ClipboardCheck", ClipboardCheckIcon);
export const Clock3 = makeIcon("Clock3", Clock3Icon);
export const ExternalLink = makeIcon("ExternalLink", ExternalLinkIcon);
export const FileCheck2 = makeIcon("FileCheck2", FileCheck2Icon);
export const FolderKanban = makeIcon("FolderKanban", FolderKanbanIcon);
export const History = makeIcon("History", HistoryIcon);
export const InfoIcon = makeIcon("InfoIcon", InfoIconGlyph);
export const Loader2 = makeIcon("Loader2", Loader2Icon);
export const LogIn = makeIcon("LogIn", LogInIcon);
export const LogOut = makeIcon("LogOut", LogOutIcon);
export const Mail = makeIcon("Mail", MailIcon);
export const Megaphone = makeIcon("Megaphone", MegaphoneIcon);
export const Menu = makeIcon("Menu", MenuIcon);
export const Moon = makeIcon("Moon", MoonIcon);
export const Palette = makeIcon("Palette", PaletteIcon);
export const Plus = makeIcon("Plus", PlusIcon);
export const Presentation = makeIcon("Presentation", PresentationIcon);
export const RefreshCw = makeIcon("RefreshCw", RefreshCwIcon);
export const RotateCcw = makeIcon("RotateCcw", RotateCcwIcon);
export const Search = makeIcon("Search", SearchIcon);
export const Send = makeIcon("Send", SendIcon);
export const Settings2 = makeIcon("Settings2", Settings2Icon);
export const Share2 = makeIcon("Share2", Share2Icon);
export const ShieldCheck = makeIcon("ShieldCheck", ShieldCheckIcon);
export const SlidersHorizontal = makeIcon("SlidersHorizontal", SlidersHorizontalIcon);
export const Sparkles = makeIcon("Sparkles", SparklesIcon);
export const Sun = makeIcon("Sun", SunIcon);
export const Trash2 = makeIcon("Trash2", Trash2Icon);
export const UploadCloud = makeIcon("UploadCloud", UploadCloudIcon);
export const UsersRound = makeIcon("UsersRound", UsersRoundIcon);
export const Video = makeIcon("Video", VideoIcon);
export const X = makeIcon("X", XIcon);
