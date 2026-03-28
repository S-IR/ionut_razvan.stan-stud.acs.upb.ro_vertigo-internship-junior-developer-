import { createServerOnlyFn } from '@tanstack/react-start'
import { getCookie } from '@tanstack/react-start/server'
import { getMeServerFn } from '@/lib/auth-context'
import { api, BetStatus } from '@/lib/api'
import { redirect } from '@tanstack/react-router'



export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}
// export const loadUserBets = createServerOnlyFn(async (userIDNum: number, page: number, betStatus?: BetStatus) => {
//   console.assert(page >= 0)
//   const user = await getMeServerFn()
//   // if (!user) throw new Error("internal server error")

//   if (!user || user.id !== userIDNum) throw redirect({ to: "/auth/login" })


//   const token = getCookie("auth_token")
//   if (!token) throw redirect({ to: "/auth/login" })

//   const res = await api.getUserBets(userIDNum, page, betStatus, {
//     headers: {
//       Cookie: `auth_token=${token}`,
//     },
//   })

//   return res
// })


export const getUserAPIKeysServerSide = createServerOnlyFn(async (page: number) => {
  console.assert(page >= 0)
  // const user = await getMeServerFn()
  // if (!user) throw new Error("internal server error")



  const token = getCookie("auth_token")
  if (!token) throw redirect({ to: "/auth/login" })

  const res = await api.getUserApiKeys(page, {
    headers: {
      Cookie: `auth_token=${token}`,
    },
  })

  return res
})
export function assert(cond: unknown, msg: string = "ASSERTION FAILED"): asserts cond {
  if (!cond) throw new Error(msg);
}