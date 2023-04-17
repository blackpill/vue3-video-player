import Queue from 'yocto-queue'
// eslint-disable-next-line import/no-webpack-loader-syntax
import Worker from 'worker-loader!@/workers/worker'

function extend (obj1, obj2) {
  const extended = {}
  // eslint-disable-next-line no-restricted-syntax, guard-for-in
  for (const key in obj1) {
    extended[key] = obj1[key]
    // eslint-disable-next-line no-prototype-builtins
    if (obj2 && obj2.hasOwnProperty(key)) {
      extended[key] = obj2[key]
    }
  }
  return extended
}
function sleep (time) {
  // eslint-disable-next-line no-promise-executor-return
  return new Promise((resolve) => setTimeout(resolve, time))
}

export default function MjpegPlayer (url, canvas, options) {
  const imageQueue = new Queue()
  const mplayer = this
  this.IMAGE_SIZE_STRETCH = 0
  this.IMAGE_SIZE_CONTAIN = 1
  this.IMAGE_SIZE_COVER = 2
  this.receivedFrame = 0
  this.displayFrame = 0

  const OPTION_DEFAULTS = {
    autoplay: false,
    drawInfo: false,
    imageSize: this.IMAGE_SIZE_CONTAIN
  }
  this.options = extend(OPTION_DEFAULTS, options)
  this.ctx = canvas.getContext('2d')

  this.preloadImage = new Image()

  this.isPlaying = false
  this.lastDate = new Date()
  this.frameCount = 0
  this.lastFames = 0
  this.loadedData = 0
  this.frameRate = 24

  if (mplayer.options.autoplay) {
    mplayer.play()
  }

  this.waitForFrameTime = () => {
    const frameTime = this.playStartTime + this.displayFrame * (1000 / this.frameRate)
    const diff = Date.now() - frameTime
    console.log(`diff = ${diff}`)
    if (diff > 0) {
      sleep(diff)
    }
  }
  this.onWindowResize = () => {
    setTimeout(mplayer.drawFrame, 0)
  }

  this.drawFrame = () => {
    mplayer.waitForFrameTime()
    const canvasWidth = mplayer.ctx.canvas.width
    const canvasHeight = mplayer.ctx.canvas.height

    // clear canvas
    mplayer.ctx.fillStyle = 'black'
    mplayer.ctx.fillRect(0, 0, canvasWidth, canvasHeight)

    let width = canvasWidth
    let height = canvasHeight
    let top = 0
    let left = 0

    if (mplayer.options.imageSize !== mplayer.IMAGE_SIZE_STRETCH) {
      const canvasRatio = canvasWidth / canvasHeight

      const imageWidth = mplayer.preloadImage.naturalWidth
      const imageHeight = mplayer.preloadImage.naturalHeight
      const imageRatio = imageWidth / imageHeight

      const takeHeight = mplayer.options.imageSize === mplayer.IMAGE_SIZE_COVER
        ? imageRatio > canvasRatio
        : imageRatio < canvasRatio

      if (takeHeight) {
        height = canvasHeight
        width = height * imageRatio
        left = (canvasWidth - width) / 2
      } else {
        width = canvasWidth
        height = width / imageRatio
        top = (canvasHeight - height) / 2
      }
    }

    mplayer.ctx.drawImage(mplayer.preloadImage, left, top, width, height)

    if (mplayer.options.drawInfo) {
      mplayer.drawMisc()
    }
  }

  this.drawMisc = () => {
    const { width } = mplayer.ctx.canvas
    const { height } = mplayer.ctx.canvas

    const date = new Date()
    const fontHeight = 11

    mplayer.ctx.font = `${fontHeight}px Consolas,Arial,Helvetica,sans-serif`
    mplayer.ctx.fillStyle = 'white'
    mplayer.ctx.strokeStyle = 'black'
    mplayer.ctx.lineWidth = 2
    mplayer.ctx.lineJoin = 'round'
    mplayer.ctx.textAlign = 'left'
    const timeString = date.toISOString()/* .replace('T', ' ').replace('Z', '') */
    mplayer.ctx.strokeText(timeString, 10, height - 10)
    mplayer.ctx.fillText(timeString, 10, height - 10)

    if (date.getSeconds() !== mplayer.lastDate.getSeconds()) {
      mplayer.lastFames = mplayer.frameCount
      mplayer.frameCount = 0
      mplayer.lastDate = date
    } else {
      mplayer.frameCount += 1
    }

    const fps = Math.ceil(1 / (1 / mplayer.lastFames))
    const frameText = `${(mplayer.loadedData / 1024 / 1024).toFixed(2)}M ${fps < 10 ? `0${fps}` : `${fps}`}F`

    mplayer.ctx.textAlign = 'right'
    mplayer.ctx.strokeText(frameText, width - 10, height - 10)
    mplayer.ctx.fillText(frameText, width - 10, height - 10)

    let state = 'PLAYING'
    let stateFill = '#00cca0'

    if (!mplayer.isPlaying) {
      state = 'PAUSED'
      stateFill = '#e74dbb'
    }

    mplayer.ctx.fillStyle = stateFill
    mplayer.ctx.fillRect(10, height - fontHeight - 22, 50, fontHeight)
    mplayer.ctx.fillStyle = 'white'
    mplayer.ctx.textAlign = 'center'
    mplayer.ctx.fillText(state, 35, height - 24)
  }

  if (!window.Worker) {
    alert("Your browser don't support worker")
  }
  // const workerURL = new URL('fetch-worker.js', import.meta.url)
  // const fetchWorker = new Worker(workerURL, { type: 'module' })
  const fetchWorker = new Worker()
  this.onImageChange = (e) => {
    if (e.type === 'load') {
      mplayer.drawFrame()
    }
    const newImage = imageQueue.dequeue()
    URL.revokeObjectURL(mplayer.preloadImage.src)
    if (newImage) {
      mplayer.displayFrame += 1
      mplayer.preloadImage.src = URL.createObjectURL(newImage)
      mplayer.loadedData += newImage.size
    } else { // If the queue is empty

    }
    if (imageQueue.size < 30 * 10) {
      fetchWorker.postMessage(
        {
          action: 'FetchNext',
          value: ''
        }
      )
    }
  }
  let imageShown = false
  this.prevTime = Date.now()
  this.currTime = Date.now()
  fetchWorker.onmessage = (e) => {
    switch (e.data.action) {
      case 'ImageFetched':
        if (e.data.value) {
          imageQueue.enqueue(e.data.value)
          mplayer.receivedFrame += 1
          mplayer.currTime = Date.now()
          const diffTime = mplayer.currTime - mplayer.prevTime
          mplayer.prevTime = mplayer.currTime
          console.log(`receivedFrame  = ${this.receivedFrame}, spend ${diffTime}`)
          if ((imageQueue.size >= 30 && !imageShown) ||
              imageQueue.size === 1) { // Fetch and display
            imageShown = true
            this.playStartTime = Date.now()
            const newImage = imageQueue.dequeue()
            mplayer.displayFrame += 1
            if (newImage) {
              mplayer.preloadImage.src = URL.createObjectURL(newImage)
              mplayer.loadedData += newImage.size
            }
          }
          if (imageQueue.size < 30 * 10) {
            fetchWorker.postMessage(
              {
                action: 'FetchNext',
                value: ''
              }
            )
          }
        }
        break
      case 'MjpegFinish':
        break
      default:
    }
  }
  this.play = () => {
    mplayer.isPlaying = true
    fetchWorker.postMessage(
      {
        action: 'Start',
        value: url
      }
    )
  }

  this.pause = () => {
    mplayer.isPlaying = false
  }

  this.togglePlay = (time) => {
    if (mplayer.isPlaying) {
      mplayer.pause()
    } else {
      mplayer.play(time)
    }
  }

  this.preloadImage.addEventListener('load', this.onImageChange)
  this.preloadImage.addEventListener('error', this.onImageChange)

  window.addEventListener('resize', this.onWindowResize)
}
