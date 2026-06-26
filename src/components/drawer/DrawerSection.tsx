import type { ReactNode } from "react";

interface DrawerSectionProps {
  title: string;
  children: ReactNode;
}

export function DrawerSection({ title, children }: DrawerSectionProps) {
  return (
    <div className="drawer-section">
      <div className="title">{title}</div>
      {children}
    </div>
  );
}
