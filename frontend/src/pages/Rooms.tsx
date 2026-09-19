import { createSignal, onMount } from 'solid-js'
import { For } from 'solid-js'
import { api } from '../api/client'
import type { RestWindow, Room, RoomStatus, Shed } from '../types'

const statuses: RoomStatus[] = ['fruiting', 'idle', 'sanitize']

function activeWindowAt(windows: RestWindow[], roomId: number, now = Date.now()): RestWindow | undefined {
  let mild: RestWindow | undefined
  for (const w of windows) {
    if (w.roomId !== roomId) continue
    if (new Date(w.startAt).getTime() <= now && now < new Date(w.endAt).getTime()) {
      if (w.intensity === 'strict') return w
      mild = w
    }
  }
  return mild
}

const empty = {
  shedId: '',
  roomCode: '',
  species: '',
  capacityBags: '',
  status: 'fruiting' as RoomStatus,
}

export default function Rooms() {
  const [rows, setRows] = createSignal<Room[]>([])
  const [sheds, setSheds] = createSignal<Shed[]>([])
  const [restWindows, setRestWindows] = createSignal<RestWindow[]>([])
  const [form, setForm] = createSignal({ ...empty })
  const [error, setError] = createSignal('')

  async function load() {
    const [rooms, shedList, windows] = await Promise.all([
      api<Room[]>('/api/rooms'),
      api<Shed[]>('/api/sheds'),
      api<RestWindow[]>('/api/rest-windows'),
    ])
    setRows(rooms)
    setSheds(shedList)
    setRestWindows(windows)
  }

  onMount(() => {
    load().catch((e) => setError(e.message))
  })

  async function onSubmit(e: Event) {
    e.preventDefault()
    setError('')
    try {
      await api('/api/rooms', {
        method: 'POST',
        body: JSON.stringify({
          shedId: Number(form().shedId),
          roomCode: form().roomCode,
          species: form().species,
          capacityBags: Number(form().capacityBags),
          status: form().status,
        }),
      })
      setForm({ ...empty })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败')
    }
  }

  async function remove(id: number) {
    if (!confirm('确认删除该出菇室？')) return
    try {
      await api(`/api/rooms/${id}`, { method: 'DELETE' })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败')
    }
  }

  function statusBadge(status: RoomStatus) {
    return `badge ${status}`
  }

  return (
    <div>
      <header class="page-header">
        <h1>出菇室</h1>
        <p class="muted">菌种、袋数容量与房态</p>
      </header>
      {error() && <div class="error">{error()}</div>}

      <form class="panel form-grid" onSubmit={onSubmit}>
        <label>
          所属菇房
          <select
            value={form().shedId}
            onChange={(e) => setForm({ ...form(), shedId: e.currentTarget.value })}
            required
          >
            <option value="">选择菇房</option>
            <For each={sheds()}>
              {(s) => <option value={String(s.id)}>{s.name}</option>}
            </For>
          </select>
        </label>
        <label>
          室编号
          <input
            value={form().roomCode}
            onInput={(e) => setForm({ ...form(), roomCode: e.currentTarget.value })}
            required
          />
        </label>
        <label>
          品种
          <input
            value={form().species}
            onInput={(e) => setForm({ ...form(), species: e.currentTarget.value })}
            required
          />
        </label>
        <label>
          容量 (袋)
          <input
            type="number"
            min="1"
            value={form().capacityBags}
            onInput={(e) => setForm({ ...form(), capacityBags: e.currentTarget.value })}
            required
          />
        </label>
        <label>
          状态
          <select
            value={form().status}
            onChange={(e) =>
              setForm({ ...form(), status: e.currentTarget.value as RoomStatus })
            }
          >
            <For each={statuses}>{(s) => <option value={s}>{s}</option>}</For>
          </select>
        </label>
        <button type="submit" class="btn primary">
          新增出菇室
        </button>
      </form>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>菇房 ID</th>
              <th>编号</th>
              <th>品种</th>
              <th>容量</th>
              <th>状态</th>
              <th>休整</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <For each={rows()}>
              {(r) => (
                <tr>
                  <td>{r.id}</td>
                  <td>{r.shedId}</td>
                  <td>{r.roomCode}</td>
                  <td>{r.species}</td>
                  <td>{r.capacityBags}</td>
                  <td>
                    <span class={statusBadge(r.status)}>{r.status}</span>
                  </td>
                  <td>
                    {(() => {
                      const w = activeWindowAt(restWindows(), r.id)
                      return w ? (
                        <span
                          class={`badge rest-${w.intensity}`}
                          title={`${new Date(w.startAt).toLocaleString()} ~ ${new Date(w.endAt).toLocaleString()}${w.note ? '；' + w.note : ''}`}
                        >
                          休整中·{w.intensity}
                        </span>
                      ) : (
                        '—'
                      )
                    })()}
                  </td>
                  <td>
                    <button type="button" class="btn ghost" onClick={() => remove(r.id)}>
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
