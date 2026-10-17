import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main id="main" className="relative grid min-h-dvh place-items-center overflow-hidden px-4 py-10">
      <div aria-hidden className="pointer-events-none absolute -top-32 start-1/2 h-96 w-[700px] -translate-x-1/2 rounded-full bg-accent/10 blur-[100px]" />
      <div className="relative w-full max-w-md">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2">
          <span className="grid size-10 place-items-center rounded-xl bg-accent font-black text-accent-fg">A</span>
          <span className="num text-3xl font-bold">APEX FIT</span>
        </Link>
        {children}
      </div>
    </main>
  );
}
