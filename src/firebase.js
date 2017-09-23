import firebase from 'firebase'
import { Observable } from 'rxjs'

const config = {
  apiKey: "AIzaSyBiW8vopfum3mgp7QAJKldu629-3wRt11Y",
  authDomain: "speakeasy-798bd.firebaseapp.com",
  databaseURL: "https://speakeasy-798bd.firebaseio.com",
  projectId: "speakeasy-798bd",
  storageBucket: "speakeasy-798bd.appspot.com",
  messagingSenderId: "105588220222"
}

function init () {
  firebase.initializeApp(config)
}

function uploadBlob (file, path) {
  // Create a root reference
  const storageRef = firebase.storage().ref()
  const pathRef = storageRef.child(path)
  return Observable.fromPromise(pathRef.put(file))
}

function storeUser (userId, { name, coverURL, videoURL }) {
  return Observable.fromPromise(
    firebase.database().ref('users/' + userId).set({
      name,
      coverURL,
      videoURL
    }))
}

function loadUserVideos () {
  return firebase.database().ref('/users')
}

export {
  init,
  uploadBlob,
  storeUser,
  loadUserVideos
}