import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/server-error')({
    component: RouteComponent,
})

function RouteComponent() {
    return <div>Internal server error</div>
}
