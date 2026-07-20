import { useState } from 'react'
import { MAX_CHANNELS } from '../gridReducer'
import { IconPlus } from './icons'

export default function AddChannelForm({ channelCount, onAdd }) {
  const [value, setValue] = useState('')
  const atCap = channelCount >= MAX_CHANNELS

  function handleSubmit(e) {
    e.preventDefault()
    if (!value.trim() || atCap) return
    onAdd(value)
    setValue('')
  }

  return (
    <form className="add-channel-form" onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Add a Twitch channel…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={atCap}
        aria-label="Twitch channel name"
        title={atCap ? `Max ${MAX_CHANNELS} channels reached` : undefined}
      />
      <button
        type="submit"
        className="btn btn-quiet"
        disabled={atCap}
        title={atCap ? `Max ${MAX_CHANNELS} channels reached` : undefined}
      >
        <IconPlus />
        <span>Add</span>
      </button>
    </form>
  )
}
