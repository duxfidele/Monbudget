export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#071324] flex items-center justify-center p-3 sm:p-4 py-8 transition-colors">
      {children}
    </div>
  )
}
