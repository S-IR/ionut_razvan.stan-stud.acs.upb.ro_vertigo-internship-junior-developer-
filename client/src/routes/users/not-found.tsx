import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/users/not-found')({
    component: RouteComponent,
})

function RouteComponent() {
    return <div>user not found</div>
}
