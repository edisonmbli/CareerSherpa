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
        html {
          background: white !important;
          color-scheme: light !important;
        }

        :root {
          color-scheme: light !important;
        }

        /* Ensure the CSS variable set by root layout propagates to print */
        body {
          margin: 0 !important;
          padding: 0 !important;
          background: white !important;
          color: rgb(15 23 42) !important;
          min-height: 100vh;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        html,
        body,
        #__next,
        main,
        [data-print-root] {
          background: white !important;
          color: rgb(15 23 42) !important;
        }

        html.dark,
        html.dark body,
        html.dark #__next,
        html.dark main,
        html.dark [data-print-root],
        body.dark {
          background: white !important;
          color-scheme: light !important;
          color: rgb(15 23 42) !important;
        }

        [data-print-root] {
          background: white !important;
          min-height: 100vh;
        }

        /* Force Noto Sans SC to be used for CJK in print */
        @media print {
          @page {
            margin: 7mm 8mm;
            size: A4 portrait;
            @bottom-right {
              content: "第 " counter(page) " 页";
              color: rgb(148 163 184);
              font-size: 9px;
            }
          }
          html {
            background: white !important;
            color-scheme: light !important;
          }
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            background: white !important;
            color: rgb(15 23 42) !important;
          }
          #__next,
          main,
          [data-print-root] {
            background: white !important;
            color: rgb(15 23 42) !important;
          }
          html.dark,
          html.dark body,
          html.dark #__next,
          html.dark main,
          html.dark [data-print-root],
          body.dark {
            background: white !important;
            color-scheme: light !important;
            color: rgb(15 23 42) !important;
          }
          /* Prevent content wider than A4 from overflowing */
          * {
            max-width: 100%;
          }
        }
      `}</style>
      <main data-print-root style={{ background: 'white', minHeight: '100vh' }}>
        {children}
      </main>
    </>
  )
}
