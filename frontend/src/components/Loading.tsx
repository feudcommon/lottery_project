// src/components/Loading.tsx
export default function Loading() {
  return (
    <div className="flex items-center justify-center p-4">
      <div className="animate-spin">⏳</div>
      <span className="ml-2">Loading...</span>
    </div>
  );
}