import React from "react";

type FaStyle = "duotone" | "light" | "regular" | "solid";

type FaIconProps = React.HTMLAttributes<HTMLElement> & {
  size?: number | string;
  strokeWidth?: number;
  color?: string;
  spin?: boolean;
  styleType?: FaStyle;
};

const stylePrefix: Record<FaStyle, string> = {
  duotone: "fad",
  light: "fal",
  regular: "far",
  solid: "fas",
};

function kebabName(name: string) {
  return name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

function normalizeSize(size?: number | string) {
  return typeof size === "number" ? `${size}px` : size;
}

function makeIcon(exportName: string, faName: string, defaultStyle: FaStyle = "regular") {
  return function FontAwesomeIcon({
    size,
    className = "",
    style,
    styleType,
    spin,
    color,
    strokeWidth: _strokeWidth,
    ...props
  }: FaIconProps) {
    const iconStyle = styleType ?? defaultStyle;
    const legacyName = kebabName(exportName);
    const iconClassName = [
      "fa-icon",
      "fa-fw",
      `lucide-${legacyName}`,
      stylePrefix[iconStyle],
      `fa-${faName}`,
      spin ? "fa-spin" : "",
      className,
    ].filter(Boolean).join(" ");

    const normalizedSize = normalizeSize(size);
    const sizingStyle = normalizedSize ? { fontSize: normalizedSize } : undefined;

    return (
      <i
        {...props}
        className={iconClassName}
        data-lucide={legacyName}
        aria-hidden={props["aria-hidden"] ?? true}
        style={{ ...sizingStyle, color, ...style }}
      />
    );
  };
}

export const AlertCircle = makeIcon("AlertCircle", "exclamation-circle", "regular");
export const AlertTriangle = makeIcon("AlertTriangle", "exclamation-triangle", "regular");
export const Archive = makeIcon("Archive", "archive", "regular");
export const ArrowRight = makeIcon("ArrowRight", "arrow-right", "light");
export const BadgeCheck = makeIcon("BadgeCheck", "badge-check", "duotone");
export const Banknote = makeIcon("Banknote", "money-bill-wave", "duotone");
export const Bell = makeIcon("Bell", "bell", "regular");
export const BellRing = makeIcon("BellRing", "bell-on", "regular");
export const BookOpen = makeIcon("BookOpen", "book-open", "duotone");
export const BriefcaseBusiness = makeIcon("BriefcaseBusiness", "briefcase", "duotone");
export const CalendarCheck = makeIcon("CalendarCheck", "calendar-check", "regular");
export const Check = makeIcon("Check", "check", "regular");
export const CheckCheck = makeIcon("CheckCheck", "check-double", "regular");
export const ChevronDown = makeIcon("ChevronDown", "chevron-down", "light");
export const ChevronLeft = makeIcon("ChevronLeft", "chevron-left", "light");
export const CircleDollarSign = makeIcon("CircleDollarSign", "dollar-sign", "duotone");
export const ClipboardCheck = makeIcon("ClipboardCheck", "clipboard-check", "regular");
export const Clock3 = makeIcon("Clock3", "clock", "regular");
export const ExternalLink = makeIcon("ExternalLink", "external-link", "regular");
export const FileCheck2 = makeIcon("FileCheck2", "file-check", "duotone");
export const FolderKanban = makeIcon("FolderKanban", "folder-open", "duotone");
export const History = makeIcon("History", "history", "regular");
export const InfoIcon = makeIcon("InfoIcon", "info-circle", "regular");
export const Loader2 = makeIcon("Loader2", "spinner-third", "regular");
export const LogIn = makeIcon("LogIn", "sign-in", "regular");
export const LogOut = makeIcon("LogOut", "sign-out", "regular");
export const Mail = makeIcon("Mail", "envelope", "regular");
export const Megaphone = makeIcon("Megaphone", "bullhorn", "duotone");
export const Menu = makeIcon("Menu", "bars", "light");
export const Moon = makeIcon("Moon", "moon", "regular");
export const Palette = makeIcon("Palette", "palette", "duotone");
export const Plus = makeIcon("Plus", "plus", "regular");
export const Presentation = makeIcon("Presentation", "presentation", "duotone");
export const RefreshCw = makeIcon("RefreshCw", "sync", "regular");
export const RotateCcw = makeIcon("RotateCcw", "undo", "regular");
export const Search = makeIcon("Search", "search", "regular");
export const Send = makeIcon("Send", "paper-plane", "regular");
export const Settings2 = makeIcon("Settings2", "sliders-h", "regular");
export const Share2 = makeIcon("Share2", "share-alt", "regular");
export const ShieldCheck = makeIcon("ShieldCheck", "shield-check", "duotone");
export const SlidersHorizontal = makeIcon("SlidersHorizontal", "sliders-h", "regular");
export const Sparkles = makeIcon("Sparkles", "sparkles", "duotone");
export const Sun = makeIcon("Sun", "sun", "regular");
export const Trash2 = makeIcon("Trash2", "trash-alt", "regular");
export const UploadCloud = makeIcon("UploadCloud", "cloud-upload", "regular");
export const UsersRound = makeIcon("UsersRound", "users", "duotone");
export const Video = makeIcon("Video", "video", "regular");
export const X = makeIcon("X", "times", "regular");
