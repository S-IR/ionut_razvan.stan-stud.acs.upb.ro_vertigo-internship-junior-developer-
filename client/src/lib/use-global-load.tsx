// lib/use-global-loading.ts
import { useEffect, useState } from "react";
import { subscribe } from "./api";

export function useGlobalLoading(): boolean {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    return subscribe(setLoading);
  }, []);

  return loading;
}
