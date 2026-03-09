/**
 * Minimal layout wrapper for the workbench print page.
 * We cannot replace the root <html>/<body> here (Next.js App Router restriction),
 * so instead we wrap children in a full-cover div. CSS in globals.css hides the
 * sidebar and header when this layout's `data-print-page` attribute is present.
 */
export default function PrintLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div data-print-page="true" className="workbench-print-page">
            {children}
        </div>
    )
}
