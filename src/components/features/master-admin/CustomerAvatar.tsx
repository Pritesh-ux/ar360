import { avatarColor, customerInitials } from "./customers-utils";

type Props = {
  name: string;
  seed?: string;
  size?: "sm" | "md" | "lg";
  imageUrl?: string | null;
};

const sizeMap = {
  sm: "h-9 w-9 text-[11px]",
  md: "h-10 w-10 text-xs",
  lg: "h-16 w-16 text-lg",
};

export default function CustomerAvatar({ name, seed, size = "md", imageUrl }: Props) {
  const color = avatarColor(seed || name);
  const cls = sizeMap[size];

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name}
        className={`${cls} shrink-0 rounded-full object-cover ring-2 ring-white`}
      />
    );
  }

  return (
    <div
      className={`${cls} ${color} flex shrink-0 items-center justify-center rounded-full font-bold ring-2 ring-white`}
    >
      {customerInitials(name)}
    </div>
  );
}
