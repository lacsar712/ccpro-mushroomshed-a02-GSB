import { createSignal, onMount } from 'solid-js'
import { For } from 'solid-js'
import { api } from '../api/client'
import type { RestIntensity, RestWindow, Room } from '../types'

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function defaultStart() {
  return toLocalInput(new Date())
}

function defaultEnd() {
  return toLocalInput(new Date(Date.now() + 3 * 24 * 3600 * 1000))
}

const empty = {
  roomId: '',
  startAt: defaultStart(),
  endAt: defaultEnd(),
  intensity: 'strict' as RestIntensity,
  note: '',
}

export default function RestWindows() {
  const [rows, setRows] = createSignal<RestWindow[]>([])
  const [rooms, setRooms] = createSignal<Room[]>([])
  const [form, setForm] = createSignal({ ...empty })
  const [error, setError] = createSignal('')

  async function load() {
    const [windows, roomList] = await Promise.all([
      api<RestWindow[]>('/api/rest-windows'),
      api<Room[]>('/api/rooms'),
    ])
    setRows(windows)
    setRooms(roomList)
  }

  onMount(() => {
    load().catch((e) => setError(e.message))
  })

  async function onSubmit(e: Event) {
    e.preventDefault()
    setError('')
    try {
      await api('/api/rest-windows', {
        method: 'POST',
        body: JSON.stringify({
          roomId: Number(form().roomId),
          startAt: new Date(form().startAt).toISOString(),
          endAt: new Date(form().endAt).toISOString(),
          intensity: form().intensity,
          note: form().note || null,
        }),
      })
      setForm({ ...empty })
      await load()
    } catch (err) {
      // 409（时间相交 / idle 室）由后端强制，直接展示后端返回信息
      setError(err instanceof Error ? err.message : '保存失败')
    }
  }

  async function remove(id: number) {
    if (!confirm('确认删除该休整窗？')) return
    try {
      await api(`/api/rest-windows/${id}`, { method: 'DELETE' })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败')
    }
  }

  function roomLabel(id: number) {
    const r = rooms().find((x) => x.id === id)
    return r ? `${r.roomCode} · ${r.species}` : `#${id}`
  }

  function isActive(w: RestWindow) {
    const now = Date.now()
    return new Date(w.startAt).getTime() <= now && now < new Date(w.endAt).getTime()
  }

  return (
    <div>
      <header class="page-header">
        <h1>休整禁采窗</h1>
        <p class="muted">
          strict：覆盖期内后端禁止新建采收；mild：允许采收但必须填写确认语。同室时间窗相交、idle 出菇室将被后端拒绝（409）。
        </p>
      </header>
      {error() && <div class="error">{error()}</div>}

      <form class="panel form-grid" onSubmit={onSubmit}>
        <label>
          出菇室
          <select
            value={form().roomId}
            onChange={(e) => setForm({ ...form(), roomId: e.currentTarget.value })}
            required
          >
            <option value="">选择出菇室</option>
            <For each={rooms()}>
              {(r) => (
                <option value={String(r.id)}>
                  {r.roomCode} · {r.species}（{r.status}）
                </option>
              )}
            </For>
          </select>
        </label>
        <label>
          开始时间
          <input
            type="datetime-local"
            value={form().startAt}
            onInput={(e) => setForm({ ...form(), startAt: e.currentTarget.value })}
            required
          />
        </label>
        <label>
          结束时间
          <input
            type="datetime-local"
            value={form().endAt}
            onInput={(e) => setForm({ ...form(), endAt: e.currentTarget.value })}
            required
          />
        </label>
        <label>
          强度
          <select
            value={form().intensity}
            onChange={(e) =>
              setForm({ ...form(), intensity: e.currentTarget.value as RestIntensity })
            }
          >
            <option value="strict">strict（禁止采收）</option>
            <option value="mild">mild（确认后可采）</option>
          </select>
        </label>
        <label>
          备注（可空）
          <input
            value={form().note}
            onInput={(e) => setForm({ ...form(), note: e.currentTarget.value })}
          />
        </label>
        <button type="submit" class="btn primary">
          开设休整窗
        </button>
      </form>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>出菇室</th>
              <th>开始</th>
              <th>结束</th>
              <th>强度</th>
              <th>状态</th>
              <th>备注</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <For each={rows()}>
              {(w) => (
                <tr>
                  <td>{w.id}</td>
                  <td>{roomLabel(w.roomId)}</td>
                  <td>{new Date(w.startAt).toLocaleString()}</td>
                  <td>{new Date(w.endAt).toLocaleString()}</td>
                  <td>
                    <span class={`badge rest-${w.intensity}`}>{w.intensity}</span>
                  </td>
                  <td>{isActive(w) ? <span class="badge fruiting">休整中</span> : '—'}</td>
                  <td>{w.note || ''}</td>
                  <td>
                    <button type="button" class="btn ghost" onClick={() => remove(w.id)}>
                      删除
                    </button>
                  </td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </div>
    </div>
  )
}
