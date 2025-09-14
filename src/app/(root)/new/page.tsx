import { checkUser } from '@/action/user-action'
import React from 'react'
import EnhancedCreateProjectPage from '@/components/enhanced-create-project'
import { userCredit } from '@/action/credit-action'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

const NewPage = async () => {
    const { userId } = await auth()

    if (!userId) {
        redirect('/sign-in')
    }

    const user = await checkUser()
    const credits = await userCredit()

  return (
   <EnhancedCreateProjectPage user={user ?? null} credits={credits} />
  )
}

export default NewPage
