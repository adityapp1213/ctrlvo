"use client";

import { useRouter } from "next/navigation";
import { useTransition, useState, useEffect } from "react";
import { Loader2, Search } from "lucide-react";

interface SearchInputProps {
  defaultValue: string;
}

export function SearchInput({ defaultValue }: SearchInputProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue]);

  function handleSearch(searchValue: string) {
    if (!searchValue) return;
    startTransition(() => {
      router.push(`/home/search?q=${encodeURIComponent(searchValue)}`);
    });
  }

  return (
    <div className="relative w-full flex items-center gap-2">
      <button
        onClick={() => handleSearch(value)}
        className="absolute left-3 text-gray-500 hover:text-gray-700 focus:outline-none"
        aria-label="Search"
      >
        <Search className="h-5 w-5" />
      </button>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search"
        className="w-full h-12 rounded-md border pl-10 pr-10 text-base outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            const val = (e.currentTarget.value || "").trim();
            handleSearch(val);
          }
        }}
      />
      {isPending && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2">
          <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
        </div>
      )}
    </div>
  );
}
