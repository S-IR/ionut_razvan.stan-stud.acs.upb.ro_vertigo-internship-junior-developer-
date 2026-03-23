export function assert(cond: boolean, msg: string = "") {
    if (cond === false) {
        throw new Error(`ASSERT FAIL: ${msg}`)
    }
}