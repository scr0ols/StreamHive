export const MAX_CHANNELS = 6
export const MIN_CHANNELS = 2

export const initialGridState = {
  channels: [], // { id, loginName, addedAt, online }
  audioMode: 'selection', // 'selection' | 'both'
  activeAudioChannelId: null,
  volumes: {}, // { [channelId]: 0-100 }
  chatBarOpen: true,
  activeChatChannelId: null,
}

export function gridReducer(state, action) {
  switch (action.type) {
    // Loading a template: channels arrive as [{ loginName, exists }] in order,
    // volumes/activeChannel keyed by loginName (the template format), and get
    // fresh session ids minted here. exists === false marks a login that no
    // longer resolves on Twitch (renamed/banned); it stays listed so the user
    // can remove it, but is skipped when picking the active audio channel.
    case 'SET_STATE': {
      if (action.channels.length < MIN_CHANNELS) return state
      const channels = action.channels.slice(0, MAX_CHANNELS).map((c) => ({
        id: crypto.randomUUID(),
        loginName: c.loginName,
        addedAt: Date.now(),
        online: undefined,
        exists: c.exists,
      }))
      const idByLogin = Object.fromEntries(channels.map((c) => [c.loginName, c.id]))

      const volumes = {}
      for (const [login, volume] of Object.entries(action.volumes ?? {})) {
        if (idByLogin[login]) volumes[idByLogin[login]] = volume
      }

      const activeAudioChannelId =
        (action.activeChannel && idByLogin[action.activeChannel]) ??
        channels.find((c) => c.exists !== false)?.id ??
        channels[0]?.id ??
        null

      return {
        channels,
        audioMode: action.audioMode,
        activeAudioChannelId,
        volumes,
        chatBarOpen: action.chatBarOpen,
        activeChatChannelId: activeAudioChannelId,
      }
    }

    case 'ADD_CHANNEL': {
      const loginName = action.loginName.trim().toLowerCase()
      if (!loginName) return state
      if (state.channels.length >= MAX_CHANNELS) return state
      if (state.channels.some((c) => c.loginName === loginName)) return state

      const channel = { id: crypto.randomUUID(), loginName, addedAt: Date.now(), online: undefined }
      return {
        ...state,
        channels: [...state.channels, channel],
        activeAudioChannelId: state.activeAudioChannelId ?? channel.id,
        activeChatChannelId: state.activeChatChannelId ?? channel.id,
      }
    }

    case 'REMOVE_CHANNEL': {
      const channels = state.channels.filter((c) => c.id !== action.id)
      const volumes = { ...state.volumes }
      delete volumes[action.id]

      let activeAudioChannelId = state.activeAudioChannelId
      if (activeAudioChannelId === action.id) {
        const fallback = channels.find((c) => c.online) ?? channels[0]
        activeAudioChannelId = fallback ? fallback.id : null
      }

      let activeChatChannelId = state.activeChatChannelId
      if (activeChatChannelId === action.id) {
        activeChatChannelId = activeAudioChannelId ?? channels[0]?.id ?? null
      }

      return { ...state, channels, volumes, activeAudioChannelId, activeChatChannelId }
    }

    case 'SET_CHANNEL_ONLINE':
      return {
        ...state,
        channels: state.channels.map((c) => (c.id === action.id ? { ...c, online: action.online } : c)),
      }

    case 'SET_AUDIO_MODE':
      return { ...state, audioMode: action.mode }

    // The chat tab follows the active audio channel by default; picking a
    // different chat tab breaks the link until the user re-selects the audio
    // channel's tab. "Following" is simply chat id === audio id, no extra flag.
    case 'SET_ACTIVE_AUDIO_CHANNEL': {
      const chatFollowsAudio = state.activeChatChannelId === state.activeAudioChannelId
      return {
        ...state,
        activeAudioChannelId: action.id,
        activeChatChannelId: chatFollowsAudio ? action.id : state.activeChatChannelId,
      }
    }

    case 'SET_VOLUME':
      return { ...state, volumes: { ...state.volumes, [action.id]: action.volume } }

    case 'TOGGLE_CHAT_BAR':
      return { ...state, chatBarOpen: !state.chatBarOpen }

    case 'SET_ACTIVE_CHAT_CHANNEL':
      return { ...state, activeChatChannelId: action.id }

    default:
      return state
  }
}
