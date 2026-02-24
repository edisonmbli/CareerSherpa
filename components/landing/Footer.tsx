import React from 'react'

export function Footer({ dict }: { dict: any }) {
    const currentYear = new Date().getFullYear()

    return (
        <footer className="w-full bg-slate-50 dark:bg-black border-t border-black/5 dark:border-white/5 py-2">
            <div className="container mx-auto px-4 md:px-6">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex flex-col items-center md:items-start gap-1">
                        <span className="text-sm font-semibold tracking-wide text-slate-800 dark:text-slate-200">
                            CareerShaper
                        </span>
                        <span className="text-xs text-muted-foreground/60 transition-colors hover:text-muted-foreground cursor-default">
                            {dict.slogan}
                        </span>
                    </div>

                    <div className="text-xs text-muted-foreground/60 transition-colors hover:text-muted-foreground cursor-default">
                        &copy; {currentYear} CareerShaper. {dict.copyright}
                    </div>
                </div>
            </div>
        </footer>
    )
}
