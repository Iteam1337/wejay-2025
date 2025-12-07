import { cn } from "@/lib/utils";

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

export function TabButton({ active, onClick, children }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-6 py-2.5 rounded-lg font-medium text-sm transition-all",
        active 
          ? "neumorphic-pressed text-primary" 
          : "neumorphic-button text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}
