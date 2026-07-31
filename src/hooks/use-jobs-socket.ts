'use client'
/**
 * Socket.io hook for real-time updates from the jobs mini-service (port 3003).
 * Listens to: match sync, playing XI updates, transfer progress, notifications.
 */
import { useEffect, useState, useRef } from 'react'
import { io, Socket } from 'socket.io-client'

export interface LiveEvent {
  type: string
  payload: any
  at: string
}

export function useJobsSocket() {
  const [connected, setConnected] = useState(false)
  const [events, setEvents] = useState<LiveEvent[]>([])
  const [transferProgress, setTransferProgress] = useState<Record<string, { completed: number; total: number; done?: boolean; items?: any[] }>>({})
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    const socket = io('/?XTransformPort=3003', {
      transports: ['websocket', 'polling'],
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    })
    socketRef.current = socket

    socket.on('connect', () => setConnected(true))
    socket.on('disconnect', () => setConnected(false))

    const push = (type: string, payload: any) => {
      setEvents((prev) => [{ type, payload, at: new Date().toISOString() }, ...prev].slice(0, 100))
    }

    socket.on('connected', (d) => push('connected', d))
    socket.on('match:synced', (d) => push('match:synced', d))
    socket.on('playingxi:updated', (d) => push('playingxi:updated', d))
    socket.on('playingxi:auto-announced', (d) => push('playingxi:auto-announced', d))
    socket.on('teams:regenerate', (d) => push('teams:regenerate', d))

    socket.on('transfer:queue:start', ({ queueId }) => {
      setTransferProgress((p) => ({ ...p, [queueId]: { completed: 0, total: 0, items: [] } }))
      push('transfer:queue:start', { queueId })
    })
    socket.on('transfer:progress', ({ queueId, completed, total }) => {
      setTransferProgress((p) => ({ ...p, [queueId]: { ...(p[queueId] || {}), completed, total } }))
    })
    socket.on('transfer:item:start', ({ queueId, teamIndex }) => {
      push('transfer:item:start', { queueId, teamIndex })
    })
    socket.on('transfer:item:done', ({ queueId, teamIndex, success, platformTeamId }) => {
      setTransferProgress((p) => {
        const cur = p[queueId] || { completed: 0, total: 0, items: [] }
        return { ...p, [queueId]: { ...cur, items: [...(cur.items || []), { teamIndex, success, platformTeamId }] } }
      })
      push('transfer:item:done', { queueId, teamIndex, success, platformTeamId })
    })
    socket.on('transfer:queue:done', ({ queueId, stats }) => {
      setTransferProgress((p) => ({ ...p, [queueId]: { ...(p[queueId] || {}), done: true, stats } }))
      push('transfer:queue:done', { queueId, stats })
    })

    return () => { socket.disconnect() }
  }, [])

  return { connected, events, transferProgress }
}
