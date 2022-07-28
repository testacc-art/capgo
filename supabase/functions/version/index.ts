import { serve } from 'https://deno.land/std@0.149.0/http/server.ts'
import { checkAppOwner, supabaseAdmin } from '../_utils/supabase.ts'
import type { definitions } from '../_utils/types_supabase.ts'
import { checkKey, sendRes } from '../_utils/utils.ts'

interface GetLatest {
  appid?: string
  app_id?: string
  channel: string
}

export const deleteVersion = async (event: Request, apikey: definitions['apikeys']): Promise<Response> => {
  const body = await event.json() as GetLatest

  if (!(await checkAppOwner(apikey.user_id, body.appid || body.app_id))) {
    console.error('You can\'t access this app')
    return sendRes({ status: 'You can\'t access this app' }, 400)
  }
  try {
    const { error: dbError } = await supabaseAdmin
      .from<definitions['app_versions']>('app_versions')
      .update({
        deleted: true,
      })
      .eq('app_id', body.appid || body.app_id)
    if (dbError) {
      console.error('Cannot delete version')
      return sendRes({ status: 'Cannot delete version', error: JSON.stringify(dbError) }, 400)
    }
  }
  catch (e) {
    console.error('Cannot delete version', e)
    return sendRes({ status: 'Cannot delete version', error: e }, 500)
  }
  return sendRes()
}

export const get = async (event: Request, apikey: definitions['apikeys']): Promise<Response> => {
  try {
    const body = (await event.json()) as GetLatest
    if (!(body.appid || body.app_id))
      return sendRes({ status: 'Missing app_id' }, 400)

    if (!apikey || !event.body)
      return sendRes({ status: 'Cannot Verify User' }, 400)
    if (!(await checkAppOwner(apikey.user_id, body.appid || body.app_id)))
      return sendRes({ status: 'You can\'t check this app' }, 400)
    const { data: dataVersions, error: dbError } = await supabaseAdmin
      .from<definitions['app_versions']>('app_versions')
      .select()
      .eq('app_id', body.appid || body.app_id)
      .eq('deleted', false)
      .order('created_at', { ascending: false })
    if (dbError || !dataVersions || !dataVersions.length)
      return sendRes({ status: 'Cannot get latest version', error: dbError }, 400)

    return sendRes({ versions: dataVersions })
  }
  catch (e) {
    return sendRes({ status: 'Cannot get latest version', error: e }, 500)
  }
}

serve(async (event: Request) => {
  const apikey_string = event.headers.get('apikey')
  const api_mode_string = event.headers.get('api_mode')

  if (!apikey_string)
    return sendRes({ status: 'Cannot find authorization' }, 400)
  const apikey: definitions['apikeys'] | null = await checkKey(apikey_string, supabaseAdmin, ['all', 'write'])
  if (!apikey || !event.body)
    return sendRes({ status: 'Cannot Verify User' }, 400)

  if (api_mode_string === 'GET')
    return get(event, apikey)
  else if (api_mode_string === 'DELETE')
    return deleteVersion(event, apikey)
  console.error('Method not allowed')
  return sendRes({ status: 'Method now allowed' }, 400)
})