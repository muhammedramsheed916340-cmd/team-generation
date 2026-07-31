/**
 * Background Jobs Mini-Service (port 3003)
 * Simplified — socket.io only, no database, no mock-cricket dependency.
 * Emits real-time events for connected clients.
 */
import { createServer } from 'http'
import { Server } from 'socket.io'

const PORT = 3003
const httpServer = createServer()
const io = new Server(httpServer, {
  path: '/',
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
})

io.on('connection', (socket) => {
  console.log(`[ws] client connected: ${socket.id}`)
  socket.emit('connected', { service: 'jobs', port: PORT, time: new Date().toISOString() })

  socket.on('subscribe:match', (matchId: string) => { socket.join(`match:${matchId}`) })
  socket.on('subscribe:transfer', (queueId: string) => { socket.join(`transfer:${queueId}`) })
  socket.on('ping', () => socket.emit('pong', { time: new Date().toISOString() }))
  socket.on('disconnect', () => { console.log(`[ws] client disconnected: ${socket.id}`) })
})

httpServer.listen(PORT, () => {
  console.log(`[jobs-service] listening on :${PORT}`)
})
