import { LogSnag } from 'https://deno.land/x/logsnag@0.1.3/src/mod.ts'
// import { LogSnag } from 'https://cdn.skypack.dev/logsnag@0.1.4?dts'
// import { LogSnag } from 'https://cdn.skypack.dev/logsnag@0.1.4?dts'
// import { LogSnag } from 'https://cdn.logsnag.com/deno/1.4.0/index.ts'
// import { LogSnag } from 'npm:logsnag'

const lsg = new LogSnag({
  token: Deno.env.get('LOGSNAG_TOKEN') || '',
  project: Deno.env.get('LOGSNAG_PROJECT') || '',
})

const insight = async (data: { title: string; value: number; icon: string }[]) => {
  const all = []
  for (const d of data)
    all.push(lsg.insight(d))

  await Promise.all(all)
}

const logsnag = { publish: lsg.publish, insight }
export { logsnag }

