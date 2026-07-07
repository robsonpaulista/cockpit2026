'use client'

import { SPLASH_SCENES, SPLASH_STUDIO_FRAME_MS, SPLASH_TOTAL_MS, type SplashSceneId } from '@/lib/splash-screen-config'
import { cn } from '@/lib/utils'

export type SplashScreenStudioProps = {
  clockMs: number
  sceneId: SplashSceneId
  sceneLabel: string
  playing: boolean
  onSeek: (ms: number) => void
  onStep: (deltaMs: number) => void
  onPlay: () => void
  onPause: () => void
  onRestart: () => void
  onJumpScene: (sceneId: SplashSceneId, edge: 'start' | 'mid' | 'end') => void
}

export function SplashScreenStudio({
  clockMs,
  sceneId,
  sceneLabel,
  playing,
  onSeek,
  onStep,
  onPlay,
  onPause,
  onRestart,
  onJumpScene,
}: SplashScreenStudioProps) {
  const pct = Math.round((clockMs / SPLASH_TOTAL_MS) * 100)
  const frame = Math.round(clockMs / SPLASH_STUDIO_FRAME_MS)

  return (
    <div className="ss-studio" role="region" aria-label="Estúdio da splash — ajuste frame a frame">
      <div className="ss-studio__readout">
        <span className="ss-studio__badge">{sceneId}</span>
        <span className="ss-studio__label">{sceneLabel}</span>
        <span className="ss-studio__time">
          {Math.round(clockMs)}ms · frame {frame} · {pct}%
        </span>
      </div>

      <div className="ss-studio__timeline">
        <input
          type="range"
          className="ss-studio__scrub"
          min={0}
          max={SPLASH_TOTAL_MS}
          step={SPLASH_STUDIO_FRAME_MS}
          value={Math.round(clockMs)}
          onChange={(e) => onSeek(Number(e.target.value))}
          aria-label="Posição na timeline"
        />
        <div className="ss-studio__markers" aria-hidden>
          {SPLASH_SCENES.map((scene) => (
            <button
              key={scene.id}
              type="button"
              className={cn('ss-studio__marker', sceneId === scene.id && 'ss-studio__marker--active')}
              style={{ left: `${(scene.at / SPLASH_TOTAL_MS) * 100}%` }}
              title={`${scene.label} (${scene.at}ms)`}
              onClick={() => onJumpScene(scene.id, 'start')}
            />
          ))}
        </div>
      </div>

      <div className="ss-studio__controls">
        <button type="button" className="ss-studio__btn" onClick={onRestart} title="Reiniciar (Home)">
          ↺
        </button>
        <button
          type="button"
          className="ss-studio__btn"
          onClick={() => onStep(-SPLASH_STUDIO_FRAME_MS)}
          title={`Frame anterior (←) · −${SPLASH_STUDIO_FRAME_MS}ms`}
        >
          −
        </button>
        <button
          type="button"
          className={cn('ss-studio__btn', 'ss-studio__btn--primary')}
          onClick={playing ? onPause : onPlay}
          title="Play / Pausa (Espaço)"
        >
          {playing ? '❚❚' : '▶'}
        </button>
        <button
          type="button"
          className="ss-studio__btn"
          onClick={() => onStep(SPLASH_STUDIO_FRAME_MS)}
          title={`Próximo frame (→) · +${SPLASH_STUDIO_FRAME_MS}ms`}
        >
          +
        </button>
      </div>

      <div className="ss-studio__scenes">
        {SPLASH_SCENES.map((scene) => (
          <div key={scene.id} className="ss-studio__scene-group">
            <button
              type="button"
              className={cn('ss-studio__scene', sceneId === scene.id && 'ss-studio__scene--active')}
              onClick={() => onJumpScene(scene.id, 'start')}
            >
              {scene.label}
            </button>
            <button
              type="button"
              className="ss-studio__scene-sub"
              onClick={() => onJumpScene(scene.id, 'mid')}
              title="Meio da cena"
            >
              ·
            </button>
            <button
              type="button"
              className="ss-studio__scene-sub"
              onClick={() => onJumpScene(scene.id, 'end')}
              title="Fim da cena"
            >
              ›
            </button>
          </div>
        ))}
      </div>

      <p className="ss-studio__hint">
        ← → frame · Espaço play · teclas 1–6 saltam para cena
      </p>
    </div>
  )
}
