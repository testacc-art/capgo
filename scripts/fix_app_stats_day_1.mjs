// list all apps in supabase and create version unknown for each
// import type { SupabaseClientOptions } from '@supabase/supabase-js'
import { createClient } from '@supabase/supabase-js'
// import type { definitions } from '~/types/supabase'

const supabaseUrl = 'https://xvwzpoazmxkqosrdewyv.supabase.co'
const supabaseAnonKey = '***'

export const useSupabase = () => {
  const options = {
    // const options: SupabaseClientOptions = {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  }
  return createClient(supabaseUrl, supabaseAnonKey, options)
}

const updateOrAppStats = async (increment, date_id, user_id) => {
  const supabase = useSupabase()
  const { data: dataAppStats } = await supabase
    .from('app_stats')
    .select()
    .eq('app_id', increment.app_id)
    .eq('date_id', date_id)
    .single()
  if (dataAppStats) {
    const { error } = await supabase
      .rpc('increment_stats', increment)
    if (error)
      console.error('increment_stats', error)
  }
  else {
    const newDay = {
      ...increment,
      user_id,
    }
    const { error } = await supabase
      .from ('app_stats')
      .insert(newDay)
    if (error)
      console.error('Cannot create app_stats', error)
  }
}

const fix_apps = async () => {
  const supabase = useSupabase()

  const { data } = await supabase
    .from('apps')
    // .from<definitions['apps']>('apps')
    .select()

  if (!data || !data.length) {
    console.error('No apps found')
    return
  }

  const all = []
  for (const app of data) {
    console.log('app', app.app_id)
    if (!app.app_id)
      return
    // console.log('app', app.app_id, devices, versions, shared, channels)
    const { data: versions } = supabase
      .storage
      .from('apps')
      .list(`${app.user_id}/${app.app_id}/versions`)
    console.log('versions', versions)
    const versionSize = versions.data.reduce((acc, cur) => acc + (cur.metadata.size || 0), 0) || 0
    if (new Date().getDate() === 1) {
      const today_id = new Date().toISOString().slice(0, 10)
      const increment = {
        app_id: app.app_id,
        date_id: '2022-09-01',
        bandwidth: 0,
        mlu: 0,
        mlu_real: 0,
        devices: 0,
        version_size: versionSize,
        channels: 0,
        shared: 0,
        versions: 0,
      }
      all.push(updateOrAppStats(increment, today_id, app.user_id))
    }
  }
  await Promise.all(all)
}

fix_apps()
