import React from "react";

type IconProps = React.SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 18, ...props }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...props,
  };
}

export function AllIcon({ size, ...props }: IconProps) {
  return (
    <svg {...Svg({ size, ...props })}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

export function StarIcon({
  size,
  filled,
  ...props
}: IconProps & { filled?: boolean }) {
  return (
    <svg {...Svg({ size, ...props })} fill={filled ? "currentColor" : "none"}>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

export function ImageIcon({ size, ...props }: IconProps) {
  return (
    <svg {...Svg({ size, ...props })}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </svg>
  );
}

export function EditIcon({ size, ...props }: IconProps) {
  return (
    <svg {...Svg({ size, ...props })}>
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  );
}

export function VideoIcon({ size, ...props }: IconProps) {
  return (
    <svg {...Svg({ size, ...props })}>
      <path d="m22 8-6 4 6 4V8Z" />
      <rect x="2" y="6" width="14" height="12" rx="2" />
    </svg>
  );
}

export function ChatIcon({ size, ...props }: IconProps) {
  return (
    <svg {...Svg({ size, ...props })}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export function SearchIcon({ size, ...props }: IconProps) {
  return (
    <svg {...Svg({ size, ...props })}>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

export function PlusIcon({ size, ...props }: IconProps) {
  return (
    <svg {...Svg({ size, ...props })}>
      <path d="M5 12h14M12 5v14" />
    </svg>
  );
}

export function CopyIcon({ size, ...props }: IconProps) {
  return (
    <svg {...Svg({ size, ...props })}>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

export function CheckIcon({ size, ...props }: IconProps) {
  return (
    <svg {...Svg({ size, ...props })}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function TrashIcon({ size, ...props }: IconProps) {
  return (
    <svg {...Svg({ size, ...props })}>
      <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" />
    </svg>
  );
}

export function CloseIcon({ size, ...props }: IconProps) {
  return (
    <svg {...Svg({ size, ...props })}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

export function ClipboardIcon({ size, ...props }: IconProps) {
  return (
    <svg {...Svg({ size, ...props })}>
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    </svg>
  );
}

export function PencilIcon({ size, ...props }: IconProps) {
  return (
    <svg {...Svg({ size, ...props })}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

export function CodeIcon({ size, ...props }: IconProps) {
  return (
    <svg {...Svg({ size, ...props })}>
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}

export function ArrowLeftIcon({ size, ...props }: IconProps) {
  return (
    <svg {...Svg({ size, ...props })}>
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </svg>
  );
}

const ICON_MAP: Record<string, React.FC<IconProps>> = {
  all: AllIcon,
  star: StarIcon,
  image: ImageIcon,
  edit: EditIcon,
  video: VideoIcon,
  chat: ChatIcon,
  code: CodeIcon,
};

export function NavIcon({
  name,
  ...props
}: IconProps & { name: string }) {
  const Cmp = ICON_MAP[name] ?? AllIcon;
  return <Cmp {...props} />;
}
