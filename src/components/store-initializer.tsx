"use client";

import { useEffect, useRef } from "react";
import { useUIStore } from "@/lib/store/ui-store";

export function StoreInitializer() {
  const initStore = useUIStore((state) => state.initStore);
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      initStore();
    }
  }, [initStore]);

  return null;
}
