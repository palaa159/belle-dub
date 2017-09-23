import React, { Component } from 'react'
import ReactPlayer from 'react-player'
import RecordRTC from 'recordrtc'
import captureVideoFrame from 'capture-video-frame'
import * as Firebase from './firebase'
import * as Rx from 'rxjs'
import 'bulma/css/bulma.css'
import './App.css'

const hasGetUserMedia = !!(navigator.getUserMedia || navigator.webkitGetUserMedia ||
  navigator.mozGetUserMedia || navigator.msGetUserMedia);

class App extends Component {

  state = {
    src: null,
    id: new Date().getTime(),
    done: false,
    recordVideo: null,
    cover: null,
    recording: false,
    isNarrating: false,
    userMuted: true,
    duration: null,
    timing: [0.3, 0.70],
    userVideos: {}
  }

  componentDidMount() {
    Firebase.init()
    Firebase.loadUserVideos().on('value', (snapshot) => {
      this.setState({
        userVideos: snapshot.val()
      })
    })
    if(!hasGetUserMedia) {
      alert("Your browser cannot stream from your webcam. Please switch to Chrome or Firefox.");
      return;
    }
    this._requestUserMedia()
  }

  _captureUserMedia(callback) {
    var params = { audio: true, video: true };
  
    navigator.getUserMedia(params, callback, (error) => {
      alert(JSON.stringify(error));
    });
  };

  _requestUserMedia() {
    console.log('requestUserMedia')
    this._captureUserMedia((stream) => {
      this.setState({ src: window.URL.createObjectURL(stream) });
    })
  }

  _record() {
    const name = window.prompt('Enter your name:')
    this.setState({ recording: true, name })
    // Start video from beginning
    this.refs.filmPlayer.seekTo(0)
    // Capture webcam
    this._captureUserMedia((stream) => {
      const options = {
        mimeType: 'video/webm\;codecs=h264', // or video/webm\;codecs=h264 or video/webm\;codecs=vp9
        bitsPerSecond: 128000
      }
      this.state.recordVideo = RecordRTC(stream, options)
      this.state.recordVideo.startRecording()
    })
  }

  _onProgress (prog) {
    console.log(prog) // prog.played == 0.x
    if (!this.state.done) {
      if (this.state.recording && !this.state.isNarrating && prog.played >= this.state.timing[0] && prog.played <= this.state.timing[1]) {
        this.setState({
          isNarrating: true,
        })
        // Stop webcam when video stopped
      } else if (this.state.isNarrating && prog.played > this.state.timing[1]) {
        this.setState({
          isNarrating: false
        })
      }
    } else {
      // When done
      if (prog.played >= this.state.timing[0] && prog.played <= this.state.timing[1]) {
        // when narrating
        this.setState({
          userMuted: false
        })
      } else {
        this.setState({
          userMuted: true
        })
      }
    }
  }

  _stopRecord () {
    this.state.recordVideo && this.state.recordVideo.stopRecording(() => {
      let params = {
        type: 'video/webm',
        data: this.state.recordVideo.blob,
      }
      this.setState({
        src: window.URL.createObjectURL(this.state.recordVideo.blob),
        userMuted: false,
        recording: false,
        cover: captureVideoFrame('userPlayer', 'jpeg')
      })

    })
  }

  _playback () {
    // play clip
    this.refs.filmPlayer.seekTo(0)
    // play video
    this.refs.userPlayer.currentTime = 0
    this.refs.userPlayer.play()
  }

  _submit () {
    alert('Submitting.. please wait')
    console.log(this.state.cover)
    Rx.Observable.forkJoin(
      Firebase.uploadBlob(this.state.recordVideo.blob, `user/${this.state.id}.webm`),
      Firebase.uploadBlob(this.state.cover.blob, `user/${this.state.id}.jpg`)
    ).flatMap(([vid, pic]) => {
      const videoURL = vid.downloadURL
      const coverURL = pic.downloadURL
      return Firebase.storeUser(this.state.id, {
        name: this.state.name,
        coverURL,
        videoURL,
        date: new Date().getTime()
      })
    })
    .subscribe(
      (res) => {
        console.log(res)
        alert('Done!')
        window.location.reload()
      }
    )
  }

  _playUser (userId) {
    this.setState({
      done: true
    })
    // Download and cache Video
    prefetch_file(this.state.userVideos[userId].videoURL, (url) => {
      this.setState({
        src: url,
      })
      this.refs.userPlayer.currentTime = 0
      this.refs.userPlayer.play()
      // this.state.userVideos[userId].videoURL
      this.refs.filmPlayer.seekTo(0)
      // play video
    })
  }

  render() {
    // https://video.fbkk1-4.fna.fbcdn.net/v/t42.3356-2/21917236_367323047036744_8778195616226718086_n.mp4/video-1506100099.mp4?_nc_eui2=v1%3AAeF97b9Sk_to6nsTesbksDBlxYPlTrNsksqTFftepwpEQjxsmTrHRtDcQ1eeHfOINtGYe89n5YgtrCM4iM8sJ4gh1AtgoTWT_bmV1DcKrTr7-A&vabr=595763&oh=85535efd802e2d7da877d74a72956215&oe=59C6D6A0&dl=1
    return (
      <div>
        <div style={{ position: 'relative' }}>
          <ReactPlayer
            ref={'filmPlayer'}
            url='https://video.fbkk1-4.fna.fbcdn.net/v/t42.3356-2/21965919_1931615930460287_2319868558803609737_n.mp4/video-1506102830.mp4?_nc_eui2=v1%3AAeGRytvWxSKh1cCwkInhIcbWOD99_H3W4RM70tSNZtVXhcXNzXI2GrxYyqlCqQs7BmlNWgGJ0RN9Zz20S8x73CiownBz_TsmHTys6CJ24mJPLw&vabr=351737&oh=6f7152786ff481b88d7a26c0315865c7&oe=59C74C0F&dl=1' 
            playing 
            controls
            onEnded={() => {
              if (this.state.done) {
                this.setState({ done: false })
              }
              if (this.state.recording) {
                this._stopRecord()
                this.setState({
                  recording: false,
                  done: true
                })
              }
            }}
            onProgress={this._onProgress.bind(this)}
            muted={this.state.isNarrating}
            width={'100%'}
          />
          <video
            controls={true}
            id={'userPlayer'}
            ref={'userPlayer'}
            autoPlay 
            muted={this.state.userMuted}
            src={this.state.src} 
            style={{ position: 'absolute', bottom: 20, right: 20, width: 200 }}
          />
        </div>
        <br />
        <div style={{ textAlign: 'center' }}>
          <div>{this.state.duration}</div>
          { !this.state.done &&
            <button className={'button'} onClick={this._record.bind(this)}>
              { this.state.recording &&
                '🔴 Recording'
              }
              {
                !this.state.recording &&
                '⏺ Start Recording'
              }
            </button>
          }
          { this.state.done && this.state.cover &&
            <div>
              <button className={'button success'} onClick={this._playback.bind(this)}>
                ⏯ Playback
              </button>
              <button className={'button success'} onClick={this._submit.bind(this)}>
                🌲 Submit
              </button>
            </div>
          }
          <div>Is narrating: {this.state.isNarrating? 'yes': 'no'}</div>
        </div>
        <div className={'columns is-multiline is-mobile'}>
          { this.state.userVideos && Object.keys(this.state.userVideos).reverse().map((key, i) =>
            <div className={'column is-2 has-text-centered'}>
              <img src={this.state.userVideos[key].coverURL} />
              <span>{this.state.userVideos[key].name}</span>
              <button onClick={() => this._playUser(key)} className={'button is-white'}>
                ⏯
              </button>
            </div>
            )
          }
        </div>
      </div>
    );
  }
}

function prefetch_file(url, fetched_callback, progress_callback, error_callback) {
  var xhr = new XMLHttpRequest()
  xhr.open("GET", url, true);
  // xhr.setRequestHeader('Access-Control-Allow-Origin', '*')
  xhr.responseType = "blob";

  xhr.addEventListener("load", function () {
    if (xhr.status === 200) {
      var URL = window.URL || window.webkitURL;
      var blob_url = URL.createObjectURL(xhr.response);
      fetched_callback(blob_url);
    } else {
      error_callback && error_callback();
    }
  }, false);

  var prev_pc = 0;
  xhr.addEventListener("progress", function (event) {
    if (event.lengthComputable) {
      var pc = Math.round((event.loaded / event.total) * 100);
      if (pc != prev_pc) {
        prev_pc = pc;
        progress_callback && progress_callback(pc)
      }
    }
  });
  xhr.send();
}

export default App;
