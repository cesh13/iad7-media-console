import type { OutputRender, Settings } from '../shared/types'
import { audioSettings } from './audio'
import { stageRender } from './stage'
import * as svc from './service'

/**
 * Which output plays the sound of each take: the first open output, in group
 * order, that shows the take. So the audio of one video is never doubled.
 */
function audioOwners(settings: Settings, openIds: string[]): Map<string, number[]> {
  const owners = new Map<string, number[]>()
  const taken = new Set<number>()
  for (const g of settings.groups) {
    const content = svc.groupLive(g.id).content
    if (!content || taken.has(content.take)) continue
    const outputId = g.outputIds.find((id) => openIds.includes(id))
    if (!outputId) continue
    taken.add(content.take)
    owners.set(outputId, [...(owners.get(outputId) ?? []), content.take])
  }
  return owners
}

/** What each open output window shows now. */
export function outputRenders(settings: Settings, openIds: string[]): Map<string, OutputRender> {
  const owners = audioOwners(settings, openIds)
  const renders = new Map<string, OutputRender>()
  for (const outputId of openIds) {
    const output = settings.outputs.find((o) => o.id === outputId)
    const group = settings.groups.find((g) => g.outputIds.includes(outputId))
    const media = (group?.idleMedia ?? [])
      .filter((m) => m.url && m.type !== 'audio')
      .map((m) => ({ type: m.type as 'image' | 'video', url: m.url! }))
    renders.set(outputId, {
      outputName: output?.name ?? '',
      groupName: group?.name ?? null,
      audioTakes: owners.get(outputId) ?? [],
      itemsVolume: audioSettings().itemsVolume,
      audioDevice: audioSettings().device,
      content: group ? svc.groupLive(group.id).content : null,
      text: group ? svc.groupLive(group.id).text : null,
      idle: { kind: group?.idle ?? 'black', media, interval: group?.idleInterval ?? 8 },
      logoUrl: settings.logo?.url,
      overlays: svc.getOverlays(),
      stage: group?.stageView ? stageRender(group, settings.groups) : undefined
    })
  }
  return renders
}
