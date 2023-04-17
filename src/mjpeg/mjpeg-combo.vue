<template>
    <audio ref="audio"></audio>
    <div ref="stage" style="height:100%">
        <canvas ref="video"></canvas>
    </div>
</template>

<script>
import coreMixins from '../mixins'
import { inject } from 'vue'
import MjpegPlayer from '../mjpeg-player'

export default {
  name: 'MjpegCombo',
  props: {
    visible: Boolean
  },
  mixins: [coreMixins],
  setup () {
    const playerKey = inject('playerKey')
    return {
      playerKey
    }
  },
  created () {
    this._playerKey = this.playerKey
  },
  data () {
    return {
      buffered: 100,
      duration: 120,
      currentTime: 0
    }
  },
  beforeMount () {

  },
  mounted () {
    const serverIp = window.location.hostname
    const serverPort = 50102
    const canvas = this.$refs.video
    const url = 'ws://' + serverIp + ':' + serverPort
    this.mplayer = new MjpegPlayer(url, canvas, {
      drawInfo: true,
      imageSize: MjpegPlayer.IMAGE_SIZE_CONTAIN
    })
  },
  methods: {
    async playAudio (startTime) {
      const context = new AudioContext()
      const audio = this.$refs.audio
      audio.src = 'http://127.0.0.1:7778/stream.aac'
      const source = context.createMediaElementSource(audio)
      source.connect(context.destination)
      audio.currentTime = startTime
      audio.play()
    },
    play () {
      const time = this.currentTime
      // this.playAudio(time)
      this.mplayer.play(time)
    },
    pause () {
      this.mplayer.pause()
    },
    canPlayType (type) {
      return true
    },
    addEventListener (event, listener) {
      this.$refs.audio.addEventListener(event, listener)
      this.$refs.video.addEventListener(event, listener)
    }

  }
}
</script>

<style lang="less">

</style>
