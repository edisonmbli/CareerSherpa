/**
 * Standalone print layout.
 * Ensures the body has white background and full font-family inheritance.
 * The root layout already loads Noto Sans SC as --font-noto-sans-sc variable.
 */
export default function PrintStandaloneLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <style>{`
        /* Ensure the CSS variable set by root layout propagates to print */
        body {
          margin: 0 !important;
          padding: 0 !important;
          background: white !important;
          min-height: 100vh;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        /* Force Noto Sans SC to be used for CJK in print */
        @media print {
          @page {
            margin: 8mm 10mm;
            size: A4 portrait;
          }
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            background: white !important;
          }
          /* Prevent content wider than A4 from overflowing */
          * {
            max-width: 100%;
          }
        }
      `}</style>
      <main style={{ background: 'white', minHeight: '100vh' }}>
        {children}
      </main>
    </>
  )
}
