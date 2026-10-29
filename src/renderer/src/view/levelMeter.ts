/**
 * Measure the output level of a playing <audio> or <video> (left and right,
 * 0..1) without changing what the people hear: the meter listens to a copy
 * of the sound (captureStream). Returns a function that stops it.
 */
export function meterElement(el: HTMLMediaElement, onLevels: (l: number, r: number) => void): () => void {
  const capture = (el as HTMLMediaElement & { captureStream?: () => MediaStream }).captureStream
  if (!capture) return () => {}
  const ctx = new AudioContext()
  let source: MediaStreamAudioSourceNode | null = null
  const splitter = ctx.createChannelSplitter(2)
  const analysers = [ctx.createAnalyser(), ctx.createAnalyser()]
  analysers.forEach((a, i) => {
    a.fftSize = 1024
    splitter.connect(a, i)
  })
  const buf = new Float32Array(1024)

  // The stream has audio only after the media starts playing.
  const connect = () => {
    if (source) return
    const stream = capture.call(el)
    if (stream.getAudioTracks().length === 0) return
    source = ctx.createMediaStreamSource(stream)
    source.connect(splitter)
  }
  el.addEventListener('playing', connect)
  if (!el.paused) connect()

  const peak = (a: AnalyserNode) => {
    a.getFloatTimeDomainData(buf)
    let max = 0
    for (const v of buf) max = Math.max(max, Math.abs(v))
    return Math.min(1, max)
  }
  const timer = setInterval(() => {
    if (!source || el.paused) {
      onLevels(0, 0)
      return
    }
    const l = peak(analysers[0])
    // Mono sound has one channel: show it on both sides.
    const r = source.channelCount > 1 ? peak(analysers[1]) : l
    onLevels(l, r)
  }, 100)

  return () => {
    clearInterval(timer)
    el.removeEventListener('playing', connect)
    source?.disconnect()
    void ctx.close()
  }
}

/** Send the sound of a media element to an output device ('' = default). */
export function applyDevice(el: HTMLMediaElement | null, device: string): void {
  const m = el as (HTMLMediaElement & { setSinkId?: (id: string) => Promise<void>; sinkId?: string }) | null
  if (!m?.setSinkId || m.sinkId === device) return
  m.setSinkId(device).catch((err) => console.warn('Could not use the audio device', device, err))
}
