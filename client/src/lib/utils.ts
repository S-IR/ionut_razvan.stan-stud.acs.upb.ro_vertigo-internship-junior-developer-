import { createServerOnlyFn } from '@tanstack/react-start'
import { getCookie } from '@tanstack/react-start/server'
import { getMeServerFn } from '@/lib/auth-context'
import { api } from '@/lib/api'
import { redirect } from '@tanstack/react-router'



export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}
export const loadUserBets = createServerOnlyFn(async (userIDNum: number) => {
  const userRes = await getMeServerFn()

  if (!userRes) throw new Error("internal server error")
  const { user } = userRes
  if (!user || user.id !== userIDNum) throw redirect({ to: "/auth/login" })

  const token = getCookie("auth_token")
  if (!token) throw redirect({ to: "/auth/login" })

  const res = await api.getUserBets(userIDNum, {
    headers: {
      Cookie: `auth_token=${token}`,
    },
  })

  return res
})