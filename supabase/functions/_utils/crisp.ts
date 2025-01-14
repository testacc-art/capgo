import axiod from 'https://deno.land/x/axiod/mod.ts'

const getAuth = () => {
  // get crisp token
  const CRISP_TOKEN_ID = Deno.env.get('CRISP_TOKEN_ID') || ''
  const CRISP_TOKEN_SECRET = Deno.env.get('CRISP_TOKEN_SECRET') || ''
  const CRISP_TOKEN = `${CRISP_TOKEN_ID}:${CRISP_TOKEN_SECRET}`
  // encode b64
  const CRISP_TOKEN_B64 = btoa(CRISP_TOKEN)
  return `Basic ${CRISP_TOKEN_B64}`
}
const getConfig = () => ({
  headers: {
    'Authorization': getAuth(),
    'X-Crisp-Tier': 'plugin',
  },
})
const baseUrl = () => {
  const CRISP_ID = Deno.env.get('CRISP_ID') || ''
  const url = `https://api.crisp.chat/v1/website/${CRISP_ID}`
  return url
}

export const postPerson = async (email: string, firstName?: string, lastName?: string, avatar?: string) => {
  const url = `${baseUrl()}/people/profile`
  const response = await axiod.post(url, {
    email,
    person: {
      nickname: `${firstName} ${lastName}`,
      avatar,
    },
  }, getConfig())
  return response.data
}
export interface Person {
  nickname?: string
  avatar?: string
  status?: string
  country?: string
  id?: string
  customer_id?: string
  product_id?: string
  price_id?: string
}

export const updatePerson = async (email: string, person?: Person, segments: string[] = []) => {
  const url = `${baseUrl()}/people/profile/${email}`
  const response = await axiod.patch(url, {
    email,
    person,
    segments,
  }, getConfig())
  return response.data
}

export const addDataPerson = async (email: string, data: Person) => {
  const url = `${baseUrl()}/people/data/${email}`
  const response = await axiod.patch(url, { data }, getConfig())
  return response.data
}

export const addEventPerson = async (email: string, data: any, text: string, color: string) => {
  const url = `${baseUrl()}/people/events/${email}`
  const response = await axiod.post(url, {
    text,
    data,
    color,
  }, getConfig())
  return response.data
}
