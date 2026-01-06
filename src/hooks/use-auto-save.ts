import { useEffect, useState } from "react";

export function useAutoSave(key: string, initialValue: string, delay: number = 1000) {
  // Try to load from localStorage first
  const savedValue = localStorage.getItem(key);
  const [value, setValue] = useState(savedValue !== null ? savedValue : initialValue);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  useEffect(() => {
    const handler = setTimeout(() => {
      localStorage.setItem(key, value);
      setLastSaved(new Date());
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [key, value, delay]);

  return { value, setValue, lastSaved };
}
