import { useEffect, useState } from 'react'
import type { TestInfo } from '../../../shared/types'
import { strings } from '../strings'

/**
 * Test pattern for one screen. It shows the screen number, the name and the
 * size, and a border on the edges, so you can see the window covers the full screen.
 */
export function TestScreen() {
  const [info, setInfo] = useState<TestInfo | null>(null)
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight })

  useEffect(() => window.mediaConsole.onTestInfo(setInfo), [])
  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  if (!info) return <div className="test" />

  const { screen: s } = info
  return (
    <div className="test">
      <div className="test-corner tl" />
      <div className="test-corner tr" />
      <div className="test-corner bl" />
      <div className="test-corner br" />
      <div className="test-center">
        <div className="test-number">{info.index}</div>
        <div className="test-name">{info.outputName ?? strings.testUnnamed}</div>
        <div className="test-detail">
          {s.label} · {s.width}×{s.height} · {strings.scale(s.scaleFactor)}
        </div>
        <div className="test-detail">
          {strings.windowSize(size.w, size.h)}
        </div>
        <div className="test-hint">{strings.testEscHint}</div>
      </div>
    </div>
  )
}
