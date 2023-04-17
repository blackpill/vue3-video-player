// import { createRequire } from 'module'
// // eslint-disable-next-line no-unused-vars
// const require = createRequire(import.meta.url)
function playAtTimeMessage (time = 0) {
  const obj = {
    action: 'playAtTime',
    value: time
  }
  const result = JSON.stringify(obj)
  return result
}

function getNextFrameMessage () {
  const obj = {
    action: 'getNextFrame',
    value: ''
  }
  const result = JSON.stringify(obj)
  return result
}

class WebsocketVideoFetcher {
  constructor (url) {
    this.url = url
    this.running = false
    this.lastDate = new Date()
    this.frameCount = 0
    this.lastFames = 0
    this.socket = new WebSocket(url)
    this.socket.binaryType = 'blob'
    this.socket.addEventListener('open', this.onSocketOpen.bind(this))
    this.socket.addEventListener('message', WebsocketVideoFetcher.onSocketMessage)
  }

  onSocketOpen () {
    this.start()
  }

  start (time = 0) {
    this.running = true
    if (this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(playAtTimeMessage(time))
    }
  }

  static onSocketMessage (message) {
    if (typeof message.data === 'string') {
      const data = JSON.parse(message.data)
      if (data.action === 'MjpegFinish') {
        postMessage({
          action: 'MjpegFinish',
          value: ''
        })
      }
    } else { // blob -> push data to queue
      postMessage({
        action: 'ImageFetched',
        value: message.data
      })
    }
  }

  fetchNext () {
    // request next frame
    if (this.running && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(getNextFrameMessage())
    }
  }

  pause () {
    this.running = false
  }

  togglePlay (time) {
    if (this.running) {
      this.pause()
    } else {
      this.start(time)
    }
  }
}
let wsFetcher
onmessage = (e) => {
  switch (e.data.action) {
    case 'FetchNext': if (wsFetcher) wsFetcher.fetchNext()
      break
    // eslint-disable-next-line no-new
    case 'Start': wsFetcher = new WebsocketVideoFetcher(e.data.value)
      break
    default:
  }
}
