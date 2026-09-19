import { createSignal, onMount } from 'solid-js'
import { For, Show } from 'solid-js'
import { api } from '../api/client'
import type { FlushHarvest, HarvestGrade, RestWindow, Room } from '../types'

const grades: HarvestGrade[] = ['A', 'B', 'C']

function toLocalInput(iso?: string) {
  const d = iso ? new Date(iso) : new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const empty = {
  roomId: '',
  harvestedAt: toLocalInput(),
  flushNo: '1',
  weightKg: '',
  grade: 'A' as HarvestGrade,
  operatorName: '',
  confirmText: '',
}

// 仅用于提示：真正的强制由后端完成（strict 409 / mild 缺确认语 400）
function activeWindowAt(
  windows: RestWindow[],
  roomId: number,
  at: number
): RestWindow | undefined {
  let mild: RestWindow | undefined
  for (const w of windows) {
    if (w.roomId !== roomId) continue
    if (new Date(w.startAt).getTime() <= at && at < new Date(w.endAt).getTime()) {
      if (w.intensity === 'strict') return w
      mild = w
    }
  }
  return mild
}

export default function FlushHarvests() {
  const [rows, setRows] = createSignal<FlushHarvest[]>([])
  const [rooms, setRooms] = createSignal<Room[]>([])
  const [restWindows, setRestWindows] = createSignal<RestWindow[]>([])
  const [form, setForm] = createSignal({ ...empty })
  const [error, setError] = createSignal('')

  async function load() {
    const [harvests, roomList, windows] = await Promise.all([
      api<FlushHarvest[]>('/api/flush-harvests'),
      api<Room[]>('/api/rooms'),
      api<RestWindow[]>('/api/rest-windows'),
    ])
    setRows(harvests)
    setRooms(roomList)
    setRestWindows(windows)
  }

  onMount(() => {
    load().catch((e) => setError(e.message))
  })

  function currentWindow(): RestWindow | undefined {
    const id = Number(form().roomId)
    if (!id) return undefined
    return activeWindowAt(restWindows(), id, new Date(form().harvestedAt).getTime())
  }

  async function onSubmit(e: Event) {
    e.preventDefault()
    setError('')
    try {
      await api('/api/flush-harvests', {
        method: 'POST',
        body: JSON.stringify({
          roomId: Number(form().roomId),
          harvestedAt: new Date(form().harvestedAt).toISOString(),
          flushNo: Number(form().flushNo),
          weightKg: Number(form().weightKg),
          grade: form().grade,
          operatorName: form().operatorName,
          confirmText: form().confirmText || null,
        }),
      })
      setForm({ ...empty, harvestedAt: toLocalInput() })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败')
    }
  }

  async function remove(id: number) {
    if (!confirm('确认删除该采收记录？')) return
    try {
      await api(`/api/flush-harvests/${id}`, { method: 'DELETE' })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败')
    }
  }

  return (
    <div>
      <header class="page-header">
        <h1>采收记录</h1>
        <p class="muted">潮次、等级与重量；weightKg 须 &gt; 0</p>
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
                  {r.roomCode} · {r.species}
                </option>
              )}
            </For>
          </select>
        </label>
        <label>
          采收时间
          <input
            type="datetime-local"
            value={form().harvestedAt}
            onInput={(e) => setForm({ ...form(), harvestedAt: e.currentTarget.value })}
            required
          />
        </label>
        <label>
          潮次
          <input
            type="number"
            min="1"
            value={form().flushNo}
            onInput={(e) => setForm({ ...form(), flushNo: e.currentTarget.value })}
            required
          />
        </label>
        <label>
          重量 (kg)
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={form().weightKg}
            onInput={(e) => setForm({ ...form(), weightKg: e.currentTarget.value })}
            required
          />
        </label>
        <label>
          等级
          <select
            value={form().grade}
            onChange={(e) =>
              setForm({ ...form(), grade: e.currentTarget.value as HarvestGrade })
            }
          >
            <For each={grades}>{(g) => <option value={g}>{g}</option>}</For>
          </select>
        </label>
        <label>
          操作人
          <input
            value={form().operatorName}
            onInput={(e) => setForm({ ...form(), operatorName: e.currentTarget.value })}
            required
          />
        </label>
        <Show when={currentWindow()}>
          {(w) => (
            <div
              class={`rest-notice rest-${w().intensity}`}
              style="grid-column: 1 / -1"
            >
              <Show
                when={w().intensity === 'mild'}
                fallback={
                  <span>
                    ⚠ 当前采收时间落在 <b>strict</b> 休整窗（#
                    {w().id}，{new Date(w().startAt).toLocaleString()} ~{' '}
                    {new Date(w().endAt).toLocaleString()}
                    ），提交将被后端拒绝（409）。
                  </span>
                }
              >
                <span>
                  当前采收时间处于 <b>mild</b> 休整窗（#{w().id}），须填写确认语后方可入库，
                  后端将强制校验：
                </span>
                <input
                  value={form().confirmText}
                  placeholder="确认语，如：经主管确认，破例采收"
                  onInput={(e) =>
                    setForm({ ...form(), confirmText: e.currentTarget.value })
                  }
                />
              </Show>
            </div>
          )}
        </Show>
        <button type="submit" class="btn primary">
          新增采收
        </button>
      </form>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>室 ID</th>
              <th>时间</th>
              <th>潮次</th>
              <th>重量</th>
              <th>等级</th>
              <th>操作人</th>
              <th>休整确认</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <For each={rows()}>
              {(r) => (
                <tr>
                  <td>{r.id}</td>
                  <td>{r.roomId}</td>
                  <td>{new Date(r.harvestedAt).toLocaleString()}</td>
                  <td>{r.flushNo}</td>
                  <td>{r.weightKg}</td>
                  <td>
                    <span class={`badge grade-${r.grade.toLowerCase()}`}>{r.grade}</span>
                  </td>
                  <td>{r.operatorName}</td>
                  <td>{r.confirmText || '—'}</td>
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
