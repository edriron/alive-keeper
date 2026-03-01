"use client";

interface LocalTimeProps {
  iso: string;
}

export function LocalTime({ iso }: LocalTimeProps) {
  return (
    <time dateTime={iso}>
      {new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).format(new Date(iso))}
    </time>
  );
}
