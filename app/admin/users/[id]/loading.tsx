import { Bone } from "@/components/ui/skeletons";

export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl space-y-6" role="status" aria-live="polite">
      <span className="sr-only">Loading customer</span>
      <Bone className="h-9 w-64" />
      <Bone className="h-10 w-full max-w-xl rounded-xl" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => <Bone key={i} className="h-24 rounded-2xl" />)}
      </div>
      <Bone className="h-80 w-full rounded-2xl" />
    </div>
  );
}
