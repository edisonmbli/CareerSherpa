import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { TrendingUp } from "lucide-react"

export function DashboardMetricCard() {
    return (
        // 注意：使用 border-border 和语义化背景色
        <Card className="w-full max-w-sm hover:shadow-md transition-all duration-200 cursor-pointer border-border bg-card">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-semibold text-foreground">总收入</CardTitle>
                    <div className="p-2 bg-primary/10 rounded-full">
                        <TrendingUp className="w-5 h-5 text-primary" />
                    </div>
                </div>
                <CardDescription>本月财务概览</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold tracking-tight">$45,231.89</span>
                    <span className="text-sm text-emerald-500 font-medium">+20.1%</span>
                </div>
                <div className="mt-4">
                    <Button className="w-full" variant="secondary">查看详情</Button>
                </div>
            </CardContent>
        </Card>
    )
}