'use client'

import { useState } from 'react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface UseServiceGuardProps {
    quotaBalance?: number | null
    cost: number
    dict: any // pass in dict.workbench.statusConsole or generic dict
    onConfirm: () => void
    onCancel?: () => void
}

export function useServiceGuard({
    quotaBalance,
    cost,
    dict,
    onConfirm,
    onCancel,
}: UseServiceGuardProps) {
    const [isOpen, setIsOpen] = useState(false)

    // Explicitly check for free tier condition
    // If balance < cost, user is forced into "Free Tier Mode"
    const isFreeTierMode = (quotaBalance ?? 0) < cost

    const execute = () => {
        if (isFreeTierMode) {
            // Open dialog to confirm free tier usage
            setIsOpen(true)
        } else {
            // Sufficient balance, proceed directly
            onConfirm()
        }
    }

    const handleConfirmFreeTier = () => {
        setIsOpen(false)
        onConfirm()
    }

    const handleCancel = () => {
        setIsOpen(false)
        if (onCancel) onCancel()
    }

    // The Dialog Component to be rendered by the consumer
    const GuardDialog = (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        {dict?.freeModeTitle || '当前为免费体验模式'}
                    </DialogTitle>
                    <DialogDescription>
                        {dict?.freeModeDesc ||
                            '建议充值解锁思考模式，获得更深度的定制服务。免费模式下将使用基础模型为您服务。'}
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="outline" onClick={handleCancel}>
                        {dict?.cancel || '取消'}
                    </Button>
                    <Button onClick={handleConfirmFreeTier}>
                        {dict?.confirmFree || '继续使用免费版'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )

    return {
        execute,
        GuardDialog,
        isFreeTierMode,
    }
}
