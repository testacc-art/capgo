<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { Doughnut } from 'vue-chartjs'
import type { ChartData, ChartOptions } from 'chart.js'
import { useSupabase } from '~/services/supabase'
import type { definitions } from '~/types/supabase'
import Spinner from '~/components/Spinner.vue'

interface Version {
  id: {
    name: string
  }
}

const { t } = useI18n()
const route = useRoute()
const supabase = useSupabase()
const id = ref('')
const isLoading = ref(true)
const downloads = ref(0)
const versions = ref<(definitions['app_versions_meta'] & Version)[]>([])
const dataDevValues = ref([] as number[])
const dataDevLabels = ref([] as string[])

// const MAU = computed(() => {
//   return versions.value.reduce((p, c) => {
//     return p + (c.devices || 0)
//   }, 0)
// })

const buildGraph = () => {
  const vals = versions.value.reduce((past, d) => {
    if (d.devices)
      past[d.id.name] = d.devices || 0
    return past
  }, { } as any)
  dataDevValues.value = Object.values(vals)
  dataDevLabels.value = Object.keys(vals)
}

const loadData = async () => {
  try {
    const { data: dataVersions } = await supabase
      .from<definitions['app_versions_meta'] & Version>('app_versions_meta')
      .select(`
        id (
            name
        ),
        devices,
        created_at,
        updated_at
      `)
      .eq('app_id', id.value)
      .order('created_at', { ascending: false })
    versions.value = dataVersions || versions.value
    buildGraph()
  }
  catch (error) {
    console.error(error)
  }
}

const getLastDownload = async () => {
  const date_id = new Date().toISOString().slice(0, 7)
  const { data } = await supabase
    .from<definitions['app_stats']>('app_stats')
    .select()
    .eq('app_id', id.value)
    .eq('date_id', date_id)
    .single()
  if (data)
    downloads.value = Math.max(data.mlu, data.mlu_real)
}

const chartData = computed<ChartData<'doughnut'>>(() => ({
  labels: dataDevLabels.value,
  datasets: [
    {
      data: dataDevValues.value,
      backgroundColor: [
        '#77CEFF',
        '#0079AF',
        '#123E6B',
        '#97B0C4',
        '#A5C8ED',
      ],
    },
  ],
}))
const chartOptions = computed<ChartOptions<'doughnut'>>(() => ({
  plugins: {
    legend: {
      position: 'left',
    },
    title: {
      display: true,
      text: 'Devices breakdown',
    },
  },
}))

watchEffect(async () => {
  if (route.path.includes('/package/')) {
    id.value = route.params.package as string
    id.value = id.value.replace(/--/g, '.')
    try {
      await getLastDownload()
      await loadData()
      isLoading.value = false
    }
    catch (error) {
      console.error(error)
    }
  }
  else {
    isLoading.value = true
  }
})
</script>

<template>
  <div v-if="isLoading" class="chat-items flex justify-center">
    <Spinner />
  </div>
  <div v-else class="flex flex-col bg-white border rounded-sm shadow-lg col-span-full sm:col-span-6 xl:col-span-4 border-slate-200 dark:bg-gray-800 dark:border-slate-900">
    <div class="px-5 pt-5">
      <h2 class="mb-2 text-2xl font-semibold dark:text-white text-slate-800">
        {{ t('stats.versions') }}
      </h2>
      <div class="mb-1 text-xs font-semibold uppercase dark:text-white text-slate-400">
        {{ t('usage.title') }}
      </div>
      <div class="flex items-start">
        <div class="mr-2 text-3xl font-bold dark:text-white text-slate-800">
          {{ versions.length.toLocaleString() }}
        </div>
      </div>
    </div>
    <Doughnut class="w-full px-3 mx-auto my-3 h-max" :chart-data="chartData" :chart-options="chartOptions" />
  </div>
</template>
