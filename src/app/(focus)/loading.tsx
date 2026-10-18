import { Skeleton } from "@/components/ui/primitives";

export default function Loading() {
  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 py-6" aria-busy="true" aria-label="Loading workout">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-64 w-full" />
      <Skeleton className="h-14 w-full" />
    </div>
  );
}
