import { Button } from '@/components/ui/button';
import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/server-error')({
    component: RouteComponent,
})

function RouteComponent() {
    return (
        <div className="flex justify-center items-center min-h-screen">
            <div className="text-center">
                <p className="mx-4 mb-2 md:max-w-xl! font-mali font-semibold text-red-200 text-3xl">Something wrong has happened on our side. We are sorry. Please retry or try again later</p>
                <Link to="/">
                    <Button variant="ghost" size="sm" className="gap-2 mb-6">
                        {/* <ArrowLeft className="w-4 h-4" /> */}
                        Go to the main page
                    </Button>

                </Link>

            </div>
        </div>
    );
}
