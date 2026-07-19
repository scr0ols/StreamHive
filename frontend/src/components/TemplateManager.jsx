import { useState } from 'react'
import { MIN_CHANNELS } from '../gridReducer'
import { IconBookmark, IconChevronDown, IconTrash, IconTwitch } from './icons'

const BACKEND_URL = 'http://localhost:3000'

// GridState -> template payload: channels/volumes/activeChannel are keyed by
// loginName in a template (session ids are meaningless across sessions).
function toTemplatePayload(name, s) {
  const loginOf = (id) => s.channels.find((c) => c.id === id)?.loginName ?? null
  return {
    name,
    channels: s.channels.map((c, i) => ({ loginName: c.loginName, order: i })),
    audioMode: s.audioMode,
    activeChannel: loginOf(s.activeAudioChannelId),
    volumes: Object.fromEntries(
      Object.entries(s.volumes)
        .map(([id, v]) => [loginOf(id), v])
        .filter(([login]) => login),
    ),
    chatBarOpen: s.chatBarOpen,
  }
}

export default function TemplateManager({ user, gridState, onLoadTemplate, onLogin, onSessionExpired }) {
  const [open, setOpen] = useState(false)
  const [templates, setTemplates] = useState(null) // null = not fetched yet
  const [listError, setListError] = useState(false)
  const [saveName, setSaveName] = useState('')
  // Explicit save state per PLAN.md edge case 10: saving/saved/error, never
  // assume success.
  const [saveStatus, setSaveStatus] = useState('idle')
  const [loadingId, setLoadingId] = useState(null)

  const canSave = gridState.channels.length >= MIN_CHANNELS

  async function fetchTemplates() {
    setListError(false)
    const res = await fetch(`${BACKEND_URL}/api/templates`, { credentials: 'include' }).catch(() => null)
    if (res?.status === 401) {
      onSessionExpired()
      return
    }
    if (!res?.ok) {
      setListError(true)
      return
    }
    setTemplates(await res.json())
  }

  function toggleOpen() {
    const next = !open
    setOpen(next)
    if (next && user) fetchTemplates()
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!saveName.trim() || !canSave) return
    setSaveStatus('saving')
    const res = await fetch(`${BACKEND_URL}/api/templates`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toTemplatePayload(saveName.trim(), gridState)),
    }).catch(() => null)
    if (res?.status === 401) {
      setSaveStatus('idle')
      onSessionExpired()
      return
    }
    if (!res?.ok) {
      setSaveStatus('error')
      return
    }
    const created = await res.json()
    setTemplates((prev) => [created, ...(prev ?? [])])
    setSaveName('')
    setSaveStatus('saved')
    setTimeout(() => setSaveStatus('idle'), 2500)
  }

  async function handleLoad(template) {
    setLoadingId(template.id)
    await onLoadTemplate(template)
    setLoadingId(null)
    setOpen(false)
  }

  async function handleDelete(id) {
    const res = await fetch(`${BACKEND_URL}/api/templates/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    }).catch(() => null)
    if (res?.status === 401) {
      onSessionExpired()
      return
    }
    if (res?.ok) setTemplates((prev) => prev.filter((t) => t.id !== id))
  }

  return (
    <div className="dropdown">
      <button type="button" className="btn btn-ghost" onClick={toggleOpen} aria-expanded={open}>
        <IconBookmark />
        <span>Templates</span>
        <IconChevronDown size={13} />
      </button>

      {open && (
        <>
          <div className="dropdown-backdrop" onClick={() => setOpen(false)} />
          <div className="dropdown-panel">
            {!user ? (
              <div className="dropdown-empty">
                <p>Log in to save and load grid templates.</p>
                <button type="button" className="btn btn-twitch" onClick={onLogin}>
                  <IconTwitch />
                  <span>Log in with Twitch</span>
                </button>
              </div>
            ) : (
              <>
                <form className="template-save" onSubmit={handleSave}>
                  <input
                    type="text"
                    placeholder="Template name…"
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    aria-label="Template name"
                  />
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={!canSave || !saveName.trim() || saveStatus === 'saving'}
                    title={canSave ? 'Save the current grid as a template' : `Add at least ${MIN_CHANNELS} channels first`}
                  >
                    {saveStatus === 'saving' ? 'Saving…' : 'Save'}
                  </button>
                </form>
                {saveStatus === 'saved' && <p className="template-status ok">Saved.</p>}
                {saveStatus === 'error' && <p className="template-status err">Save failed, try again.</p>}
                {!canSave && <p className="template-status">Add at least {MIN_CHANNELS} channels to save.</p>}

                <div className="template-list">
                  {listError && <p className="template-status err">Couldn't load templates.</p>}
                  {templates?.length === 0 && <p className="template-status">No templates saved yet.</p>}
                  {templates?.map((t) => (
                    <div key={t.id} className="template-row">
                      <div className="template-row-info">
                        <span className="template-row-name">{t.name}</span>
                        <span className="template-row-meta">
                          {t.channels.length} channels · {t.audioMode === 'selection' ? 'Selection' : 'Both/All'}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="btn btn-ghost btn-small"
                        onClick={() => handleLoad(t)}
                        disabled={loadingId !== null}
                      >
                        {loadingId === t.id ? 'Loading…' : 'Load'}
                      </button>
                      <button
                        type="button"
                        className="panel-btn icon-only remove-btn"
                        onClick={() => handleDelete(t.id)}
                        title={`Delete "${t.name}"`}
                        aria-label={`Delete template ${t.name}`}
                      >
                        <IconTrash />
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
