import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/markets/not-found')({
    component: RouteComponent,
})

function RouteComponent() {
    return <div>market not found</div>
}
