"use client";

import { TooltipProvider } from "@/components/ui/tooltip";

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <TooltipProvider>
      {children}
    </TooltipProvider>
  );
}
