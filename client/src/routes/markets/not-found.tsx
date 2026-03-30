import { Button } from '@/components/ui/button'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'

export const Route = createFileRoute('/markets/not-found')({
    component: RouteComponent,
})

function RouteComponent() {
    return (
        <div className="flex justify-center items-center min-h-screen">
            <div className="text-center">
                <p className="mb-2 font-mali font-semibold text-cyan-200 text-4xl lg:text-8xl">Market Not Found</p>
                <Link to="/">
                    <Button variant="ghost" size="sm" className="gap-2 mb-6">
                        {/* <ArrowLeft className="w-4 h-4" /> */}
                        Go to the main page
                    </Button>

                </Link>

            </div>
        </div>
    )
}
