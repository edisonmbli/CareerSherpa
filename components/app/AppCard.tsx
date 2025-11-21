import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export function AppCard(
  props: React.ComponentProps<typeof Card> & { padded?: boolean }
) {
  const { className, padded = true, ...rest } = props
  return (
    <Card
      className={cn('shadow-sm dark:shadow-lg border-0 dark:border dark:border-white/10 bg-card text-card-foreground', className)}
      {...rest}
    >
      {padded ? <div className="p-6">{rest.children}</div> : rest.children}
    </Card>
  )
}

export function AppCardHeader(
  props: React.ComponentProps<typeof CardHeader>
) {
  const { className, ...rest } = props
  return <CardHeader className={cn('p-6', className)} {...rest} />
}

export function AppCardTitle(
  props: React.ComponentProps<typeof CardTitle>
) {
  const { className, ...rest } = props
  return <CardTitle className={cn('text-xl', className)} {...rest} />
}

export function AppCardDescription(
  props: React.ComponentProps<typeof CardDescription>
) {
  const { className, ...rest } = props
  return (
    <CardDescription className={cn('text-sm text-muted-foreground', className)} {...rest} />
  )
}

export function AppCardContent(
  props: React.ComponentProps<typeof CardContent>
) {
  const { className, ...rest } = props
  return <CardContent className={cn('p-6', className)} {...rest} />
}

export function AppCardFooter(
  props: React.ComponentProps<typeof CardFooter>
) {
  const { className, ...rest } = props
  return <CardFooter className={cn('p-6', className)} {...rest} />
}