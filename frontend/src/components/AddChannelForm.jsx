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
      />
      <button type="submit" className="btn btn-primary" disabled={atCap}>
        <IconPlus />
        <span>Add</span>
      </button>
      {atCap && <span className="add-channel-cap">5-channel max reached</span>}
    </form>
  )
}
