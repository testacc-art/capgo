import { serve } from 'https://deno.land/std@0.143.0/http/server.ts'
import { addEventPerson } from '../_utils/crisp.ts'
import { supabaseAdmin } from '../_utils/supabase.ts'
import type { definitions } from '../_utils/types_supabase.ts'
import { sendRes } from '../_utils/utils.ts'

serve(async (event: Request) => {
  const supabase = supabaseAdmin
  const API_SECRET = Deno.env.get('API_SECRET')
  const authorizationSecret = event.headers.get('apisecret')
  if (!authorizationSecret) {
    console.error('Cannot find authorization secret')
    return sendRes({ status: 'Cannot find authorization secret' }, 400)
  }
  if (!authorizationSecret || !API_SECRET || authorizationSecret !== API_SECRET) {
    console.error('Fail Authorization', authorizationSecret, API_SECRET)
    return sendRes({ message: 'Fail Authorization', authorizationSecret, API_SECRET }, 400)
  }
  try {
    const { data: users } = await supabase
      .from<definitions['users']>('users')
      .select()

    if (!users || !users.length)
      return sendRes({ status: 'error', message: 'no apps' })
    // explore all apps
    const all = []
    for (const user of users) {
      all.push(supabaseAdmin
        .rpc<boolean>('is_trial', { userid: user.id })
        .single()
        .then(async (res) => {
          if (res.data) {
            return supabaseAdmin
              .from<definitions['stripe_info']>('stripe_info')
              .update({ is_good_plan: true })
              .eq('customer_id', user.customer_id)
              .then()
          }
          const { data: is_good_plan } = await supabaseAdmin
            .rpc<boolean>('is_good_plan', { userid: user.id })
            .single()
          console.log('is_good_plan', user.id, is_good_plan)
          if (!is_good_plan)
            await addEventPerson(user.email, {}, 'user:need_upgrade', 'red')
          return supabaseAdmin
            .from<definitions['stripe_info']>('stripe_info')
            .update({ is_good_plan: !!is_good_plan })
            .eq('customer_id', user.customer_id)
            .then()
        }))
    }
    await Promise.all(all)
    return sendRes()
  }
  catch (e) {
    console.log('e', e)
    return sendRes({
      status: 'Error unknow',
      error: JSON.stringify(e),
    }, 500)
  }
})