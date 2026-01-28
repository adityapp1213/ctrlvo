export default function Loading() {
  return (
    <div className="h-screen w-full bg-background flex items-center justify-center">
      <div className="w-full max-w-md px-6">
        <div className="h-6 w-40 bg-accent rounded-md mb-4" />
        <div className="h-4 w-full bg-accent rounded-md mb-2" />
        <div className="h-4 w-5/6 bg-accent rounded-md mb-2" />
        <div className="h-4 w-2/3 bg-accent rounded-md" />
        <div className="mt-8 h-5 w-56 bg-accent rounded-md" />
      </div>
    </div>
  );
}
