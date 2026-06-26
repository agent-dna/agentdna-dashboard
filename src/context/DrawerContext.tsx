import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { Agent, Tool, Intent, Interaction } from "../types";

export type DrawerKind = "agent" | "tool" | "interaction" | "intent";
export type DrawerEntity = Agent | Tool | Interaction | Intent;

interface DrawerState {
  kind: DrawerKind;
  entity: DrawerEntity;
}

interface DrawerContextValue {
  drawer: DrawerState | null;
  openDrawer: (kind: DrawerKind, entity: DrawerEntity) => void;
  closeDrawer: () => void;
}

const Ctx = createContext<DrawerContextValue | null>(null);

export function DrawerProvider({ children }: { children: ReactNode }) {
  const [drawer, setDrawer] = useState<DrawerState | null>(null);
  const openDrawer = useCallback(
    (kind: DrawerKind, entity: DrawerEntity) => setDrawer({ kind, entity }),
    [],
  );
  const closeDrawer = useCallback(() => setDrawer(null), []);
  const value = useMemo(() => ({ drawer, openDrawer, closeDrawer }), [drawer, openDrawer, closeDrawer]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDrawer() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useDrawer must be used inside DrawerProvider");
  return v;
}
