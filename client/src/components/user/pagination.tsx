import {
    Pagination, PaginationContent, PaginationEllipsis,
    PaginationItem, PaginationLink, PaginationNext, PaginationPrevious,
} from "@/components/ui/pagination"


export function PaginationControl({ currentPage, onPageChange, totalPages }: { onPageChange: (pageAPIValue: number) => void, currentPage: number, totalPages: number }) {
    return <Pagination className="mt-4">
        <PaginationContent>
            <PaginationItem>
                <PaginationPrevious
                    onClick={() => onPageChange(Math.max(0, currentPage - 1))}
                    className={currentPage === 0 ? "pointer-events-none opacity-50" : "cursor-pointer"} />
            </PaginationItem>

            <PaginationItem>
                <PaginationLink
                    isActive={currentPage === 0}
                    onClick={() => onPageChange(0)}
                    className="cursor-pointer"
                >
                    1
                </PaginationLink>
            </PaginationItem>

            {currentPage > 3 && (
                <PaginationItem>
                    <PaginationEllipsis />
                </PaginationItem>
            )}

            {Array.from({ length: totalPages }, (_, i) => i)
                .filter((i) => i !== 0 && i !== totalPages - 1 && Math.abs(i - currentPage) <= 2)
                .map((i) => (
                    <PaginationItem key={i}>
                        <PaginationLink
                            isActive={currentPage === i}
                            onClick={() => onPageChange(i)}
                            className="cursor-pointer"
                        >
                            {i + 1}
                        </PaginationLink>
                    </PaginationItem>
                ))}

            {currentPage < totalPages - 4 && (
                <PaginationItem>
                    <PaginationEllipsis />
                </PaginationItem>
            )}

            {totalPages > 1 && (
                <PaginationItem>
                    <PaginationLink
                        isActive={currentPage === totalPages - 1}
                        onClick={() => onPageChange(totalPages - 1)}
                        className="cursor-pointer"
                    >
                        {totalPages}
                    </PaginationLink>
                </PaginationItem>
            )}

            <PaginationItem>
                <PaginationNext
                    onClick={() => onPageChange(Math.min(totalPages - 1, currentPage + 1))}
                    className={currentPage === totalPages - 1 ? "pointer-events-none opacity-50" : "cursor-pointer"} />
            </PaginationItem>
        </PaginationContent>
    </Pagination>
}
