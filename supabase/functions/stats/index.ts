import { serve } from 'https://deno.land/std@0.139.0/http/server.ts'
import { supabaseAdmin } from '../_utils/supabase.ts'
import type { definitions } from '../_utils/types_supabase.ts'
import { checkKey, sendRes } from '../_utils/utils.ts'

interface AppStats {
  platform: string
  action: string
  device_id: string
  version_name?: string
  plugin_version?: string
  version: number
  version_build: string
  app_id: string
}

serve(async(event: Request) => {
  const supabase = supabaseAdmin
  const authorization = event.headers.get('apikey')
  if (!authorization)
    return sendRes({ status: 'Cannot find authorization' }, 400)
  const apikey: definitions['apikeys'] | null = await checkKey(authorization, supabase, ['upload', 'all', 'write'])
  if (!apikey || !event.body)
    return sendRes({ status: 'Cannot Verify User' }, 400)
  try {
    let statsDb = 'stats'
    let deviceDb = 'devices'
    const body = (await event.json()) as AppStats
    const device: Partial<definitions['devices'] | definitions['devices_onprem']> = {
      platform: body.platform as definitions['stats']['platform'],
      device_id: body.device_id,
      app_id: body.app_id,
      plugin_version: body.plugin_version || '2.3.3',
    }

    const stat: Partial<definitions['stats']> = {
      platform: body.platform as definitions['stats']['platform'],
      device_id: body.device_id,
      action: body.action,
      app_id: body.app_id,
      version_build: body.version_build,
    }

    const { data, error } = await supabase
      .from<definitions['app_versions']>('app_versions')
      .select()
      .eq('app_id', body.app_id)
      .eq('name', body.version_name || 'unknown')
    if (data && data.length && !error) {
      stat.version = data[0].id
      device.version = data[0].id
    }
    else {
      device.version = body.version_name || 'unknown'
      stat.version = body.version || 0
      statsDb = `${statsDb}_onprem`
      deviceDb = `${deviceDb}_onprem`
    }
    await supabase
      .from(deviceDb)
      .upsert(device)
    await supabase
      .from(statsDb)
      .insert(stat)
    return sendRes()
  }
  catch (e) {
    return sendRes({
      status: 'Error unknow',
      error: JSON.stringify(e),
    }, 500)
  }
})