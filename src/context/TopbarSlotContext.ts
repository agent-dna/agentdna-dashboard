import { createContext, useContext } from "react";

/**
 * The empty middle of the app's top bar. A page can portal a title into it (the flow page
 * shows the intent there); null until the bar has mounted.
 */
export const TopbarSlotContext = createContext<HTMLElement | null>(null);

export const useTopbarSlot = () => useContext(TopbarSlotContext);
