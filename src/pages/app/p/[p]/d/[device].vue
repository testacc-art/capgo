<script setup lang="ts">
import {
  IonContent, IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonItem,
  IonItemDivider,
  IonLabel, IonList, IonListHeader, IonNote, IonPage, IonSearchbar,
  actionSheetController, alertController, toastController,
} from '@ionic/vue'
import { computed, ref, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { formatDate } from '~/services/date'
import { useSupabase } from '~/services/supabase'
import type { definitions } from '~/types/supabase'
import TitleHead from '~/components/TitleHead.vue'
import Spinner from '~/components/Spinner.vue'

interface Device {
  version: definitions['app_versions']
}
interface Channel {
  version: definitions['app_versions']
}
interface ChannelDev {
  channel_id: definitions['channels'] & Channel
}
interface InfiniteScrollCustomEvent extends CustomEvent {
  target: HTMLIonInfiniteScrollElement
}
interface Stat {
  version: {
    name: string
  }
}
const fetchLimit = 40
let fetchOffset = 0
const isDisabled = ref(false)
const { t } = useI18n()
const route = useRoute()
const supabase = useSupabase()
const packageId = ref<string>('')
const search = ref<string>('')
const id = ref<string>()
const auth = supabase.auth.user()
const isLoading = ref(true)
const isLoadingSub = ref(true)
const device = ref<definitions['devices'] & Device>()
const logs = ref<(definitions['stats'] & Stat)[]>([])
const filtered = ref<(definitions['stats'] & Stat)[]>([])
const deviceOverride = ref<definitions['devices_override'] & Device>()
const channels = ref<(definitions['channels'] & Channel)[]>([])
const versions = ref<definitions['app_versions'][]>([])
const channelDevice = ref<definitions['channel_devices'] & ChannelDev>()

const logFiltered = computed(() => {
  if (search.value)
    return filtered.value
  return logs.value
})
const getVersion = async () => {
  try {
    const { data, error } = await supabase
      .from<definitions['app_versions']>('app_versions')
      .select()
      .eq('app_id', packageId.value)
      .eq('deleted', false)
      .order('created_at', { ascending: false })
    if (error) {
      console.error('getVersion', error)
      return
    }
    versions.value = data || versions.value
  }
  catch (error) {
    console.error(error)
  }
}
const getChannels = async () => {
  try {
    const { data, error } = await supabase
      .from<definitions['channels'] & Channel>('channels')
      .select(`
        id,
        name,
        created_at,
        updated_at
      `)
      .eq('app_id', packageId.value)
    if (error) {
      console.error('getChannels', error)
      return
    }
    channels.value = data || []
  }
  catch (error) {
    console.error(error)
  }
}
const onSearchLog = async (val: string | undefined) => {
  if (val === undefined) {
    search.value = ''
    return
  }
  search.value = val
  isLoadingSub.value = true
  const { data: dataStats } = await supabase
    .from<(definitions['stats'] & Stat)>('stats')
    .select(`
        device_id,
        action,
        platform,
        version_build,
        version (
            name
        ),
        created_at,
        updated_at
      `)
    .eq('device_id', id.value)
    .order('created_at', { ascending: false })
    .like('action', `%${search.value}%`)
  logs.value = dataStats || []
  isLoadingSub.value = false
}
const loadStatsData = async (event?: InfiniteScrollCustomEvent) => {
  isLoadingSub.value = true
  try {
    // create a date object for the last day of the previous month with dayjs
    const { data: dataStats } = await supabase
      .from<(definitions['stats'] & Stat)>('stats')
      .select(`
        device_id,
        action,
        platform,
        version_build,
        version (
            name
        ),
        created_at,
        updated_at
      `)
      .eq('device_id', id.value)
      .order('created_at', { ascending: false })
      .range(fetchOffset, fetchOffset + fetchLimit - 1)
    if (!dataStats)
      return
    logs.value.push(...dataStats)
    if (dataStats.length === fetchLimit)
      fetchOffset += fetchLimit
    else
      isDisabled.value = true
  }
  catch (error) {
    console.error(error)
  }
  isLoadingSub.value = false
  if (event)
    event.target.complete()
}
const getChannelOverride = async () => {
  const { data, error } = await supabase
    .from<definitions['channel_devices'] & ChannelDev>('channel_devices')
    .select(`
      device_id,
      app_id,
      channel_id (
        name,
        version (
          name
        )
      ),
      created_at,
      updated_at
    `)
    .eq('app_id', packageId.value)
    .eq('device_id', id.value)
    .single()
  if (error) {
    console.error('getChannelOverride', error)
    return
  }
  channelDevice.value = data || undefined
}
const getDeviceOverride = async () => {
  const { data, error } = await supabase
    .from<definitions['devices_override'] & Device>('devices_override')
    .select(`
      device_id,
      app_id,
      version (
          name
      ),
      created_at,
      updated_at
    `)
    .eq('app_id', packageId.value)
    .eq('device_id', id.value)
    .single()
  if (error) {
    console.error('getDeviceOverride', error)
    return
  }
  deviceOverride.value = data || undefined
}
const getDevice = async () => {
  if (!id.value)
    return
  try {
    const { data, error } = await supabase
      .from<definitions['devices'] & Device>('devices')
      .select(`
          device_id,
          app_id,
          platform,
          os_version,
          version (
            name,
            app_id,
            bucket_id,
            created_at
          ),
          version_build,
          created_at,
          plugin_version,
          updated_at
        `)
      .eq('device_id', id.value)
      .single()
    if (data && !error)
      device.value = data
    else
      console.error('no devices', error)
    // console.log('device', device.value)
  }
  catch (error) {
    console.error(error)
  }
}

const loadData = async () => {
  isLoading.value = true
  logs.value = []
  fetchOffset = 0
  await Promise.all([
    getDevice(),
    getDeviceOverride(),
    getChannelOverride(),
    getChannels(),
    getVersion(),
    loadStatsData(),
  ])
  isLoading.value = false
}

const upsertDevVersion = async (device: string, v: definitions['app_versions']) => {
  return supabase
    .from<definitions['devices_override']>('devices_override')
    .upsert({
      device_id: device,
      version: v.id,
      app_id: packageId.value,
      created_by: auth?.id,
    })
}
const didCancel = async (name: string) => {
  const alert = await alertController
    .create({
      header: t('alert.confirm-delete'),
      message: `${t('alert.delete-message')} ${name}?`,
      buttons: [
        {
          text: t('button.cancel'),
          role: 'cancel',
        },
        {
          text: t('button.delete'),
          id: 'confirm-button',
        },
      ],
    })
  await alert.present()
  return alert.onDidDismiss().then(d => (d.role === 'cancel'))
}
const delDevVersion = async (device: string) => {
  if (await didCancel(t('channel.device')))
    return
  return supabase
    .from<definitions['devices_override']>('devices_override')
    .delete()
    .eq('device_id', device)
    .eq('app_id', packageId.value)
}
const updateOverride = async () => {
  const buttons = []
  if (deviceOverride.value) {
    buttons.push({
      text: t('button.remove'),
      handler: async () => {
        device.value?.device_id && delDevVersion(device.value?.device_id)
        const toast = await toastController
          .create({
            message: t('device.unlink_version'),
            duration: 2000,
          })
        await toast.present()
        await loadData()
      },
    })
  }
  for (const version of versions.value) {
    buttons.push({
      text: version.name,
      handler: async () => {
        if (!device.value?.device_id)
          return
        isLoading.value = true
        try {
          await upsertDevVersion(device.value?.device_id, version)
          const toast = await toastController
            .create({
              message: t('device.link_version'),
              duration: 2000,
            })
          await toast.present()
          await loadData()
        }
        catch (error) {
          console.error(error)
          const toast = await toastController
            .create({
              message: t('device.link_fail'),
              duration: 2000,
            })
          await toast.present()
        }
        isLoading.value = false
      },
    })
  }
  buttons.push({
    text: t('button.cancel'),
    role: 'cancel',
    handler: () => {
      // console.log('Cancel clicked')
    },
  })
  const actionSheet = await actionSheetController.create({
    header: t('package.link_version'),
    buttons,
  })
  await actionSheet.present()
}
const upsertDevChannel = async (device: string, channel: definitions['channels']) => {
  return supabase
    .from<definitions['channel_devices']>('channel_devices')
    .upsert({
      device_id: device,
      channel_id: channel.id,
      app_id: packageId.value,
      created_by: auth?.id,
    })
}
const delDevChannel = async (device: string) => {
  if (await didCancel(t('channel.title')))
    return
  return supabase
    .from<definitions['channel_devices']>('channel_devices')
    .delete()
    .eq('device_id', device)
    .eq('app_id', packageId.value)
}
const updateChannel = async () => {
  const buttons = []
  if (channelDevice.value) {
    buttons.push({
      text: t('button.remove'),
      handler: async () => {
        device.value?.device_id && delDevChannel(device.value?.device_id)
        const toast = await toastController
          .create({
            message: t('device.unlink_channel'),
            duration: 2000,
          })
        await toast.present()
        await loadData()
      },
    })
  }
  for (const channel of channels.value) {
    buttons.push({
      text: channel.name,
      handler: async () => {
        if (!device.value?.device_id)
          return
        isLoading.value = true
        try {
          await upsertDevChannel(device.value?.device_id, channel)
          const toast = await toastController
            .create({
              message: t('device.link_channel'),
              duration: 2000,
            })
          await toast.present()
          await loadData()
        }
        catch (error) {
          console.error(error)
          const toast = await toastController
            .create({
              message: t('device.link_fail'),
              duration: 2000,
            })
          await toast.present()
        }
        isLoading.value = false
      },
    })
  }
  buttons.push({
    text: t('button.cancel'),
    role: 'cancel',
    handler: () => {
      // console.log('Cancel clicked')
    },
  })
  const actionSheet = await actionSheetController.create({
    header: t('package.link_channel'),
    buttons,
  })
  await actionSheet.present()
}

watchEffect(async () => {
  if (route.path.includes('/d/')) {
    packageId.value = route.params.p as string
    packageId.value = packageId.value.replace(/--/g, '.')
    id.value = route.params.device as string
    await loadData()
  }
})
</script>

<template>
  <IonPage>
    <TitleHead :title="t('device.title')" color="warning" />
    <IonContent :fullscreen="true">
      <!-- <TitleHead :title="t('device.title')" big color="warning" condense /> -->
      <IonList>
        <IonListHeader>
          <span class="text-vista-blue-500">
            {{ device?.device_id }}
          </span>
        </IonListHeader>
        <IonItemDivider>
          <IonLabel>
            {{ t('device.info') }}
          </IonLabel>
        </IonItemDivider>
        <IonItem v-if="device">
          <IonLabel>
            <h2 class="text-sm text-azure-500">
              {{ t('device.platform') }}
            </h2>
          </IonLabel>
          <IonNote slot="end">
            {{ device.platform }}
          </IonNote>
        </IonItem>
        <IonItem v-if="device">
          <IonLabel>
            <h2 class="text-sm text-azure-500">
              {{ t('device.plugin_version') }}
            </h2>
          </IonLabel>
          <IonNote slot="end">
            {{ device.plugin_version }}
          </IonNote>
        </IonItem>
        <IonItem v-if="device">
          <IonLabel>
            <h2 class="text-sm text-azure-500">
              {{ t('device.version') }}
            </h2>
          </IonLabel>
          <IonNote slot="end">
            {{ device.version.name }}
          </IonNote>
        </IonItem>
        <IonItem v-if="device">
          <IonLabel>
            <h2 class="text-sm text-azure-500">
              {{ t('version-builtin') }}
            </h2>
          </IonLabel>
          <IonNote slot="end">
            {{ device.version_build }}
          </IonNote>
        </IonItem>
        <IonItem v-if="device">
          <IonLabel>
            <h2 class="text-sm text-azure-500">
              {{ t('device.last_update') }}
            </h2>
          </IonLabel>
          <IonNote slot="end">
            {{ formatDate(device.updated_at) }}
          </IonNote>
        </IonItem>
        <IonItem v-if="device">
          <IonLabel>
            <h2 class="text-sm text-azure-500">
              {{ t('device.os_version') }}
            </h2>
          </IonLabel>
          <IonNote slot="end">
            {{ device.os_version || 'unknow' }}
          </IonNote>
        </IonItem>
        <IonItem v-if="device">
          <IonLabel>
            <h2 class="text-sm text-azure-500">
              {{ t('device.created_at') }}
            </h2>
          </IonLabel>
          <IonNote slot="end">
            {{ formatDate(device.created_at) }}
          </IonNote>
        </IonItem>
        <IonItem v-if="device" class="cursor-pointer" @click="updateOverride">
          <IonLabel>
            <h2 class="text-sm text-azure-500">
              {{ t('device.force_version') }}
            </h2>
          </IonLabel>
          <IonNote slot="end">
            {{ deviceOverride?.version?.name || t('device.no_override') }}
          </IonNote>
        </IonItem>
        <IonItem v-if="device" class="cursor-pointer" @click="updateChannel">
          <IonLabel>
            <h2 class="text-sm text-azure-500">
              {{ t('device.channel') }}
            </h2>
          </IonLabel>
          <IonNote slot="end">
            {{ channelDevice?.channel_id.name || t('device.no_channel') }}
          </IonNote>
        </IonItem>
      </IonList>
      <IonList>
        <IonListHeader>
          <IonLabel>Logs</IonLabel>
        </IonListHeader>
        <div v-if="isLoadingSub" class="flex justify-center chat-items">
          <Spinner />
        </div>
        <IonSearchbar v-if="!isLoadingSub" @ion-change="onSearchLog($event.detail.value)" />
        <template v-for="s in logFiltered" :key="s.id">
          <IonItem>
            <IonLabel>
              <h2 class="text-sm text-azure-500">
                {{ s.action }} {{ s.version.name }}, builtin {{ s.version_build }}
              </h2>
            </IonLabel>
            <IonNote slot="end">
              {{ formatDate(s.created_at) }}
            </IonNote>
          </IonItem>
        </template>
        <IonInfiniteScroll
          threshold="100px"
          :disabled="isDisabled || !!search"
          @ion-infinite="loadStatsData($event)"
        >
          <IonInfiniteScrollContent
            loading-spinner="bubbles"
            :loading-text="t('loading-more-data')"
          />
        </IonInfiniteScroll>
      </IonList>
    </IonContent>
  </IonPage>
</template>

<style>
  #confirm-button {
    background-color: theme('colors.red.500');
    color: theme('colors.white');
  }
</style>
