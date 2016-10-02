// Copyright 2014 Google Inc. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * Width of progress bar in pixel
 **/
function getProgressBarWidth() {
    return $("#progressbar").width();
}

function showCastButton(show) {
    $("#chromecast")[0].hidden = !show;
}

function showCastState(casting) {
    if (casting) {
        $("#chromecast").addClass("casting");
        $("#cast_blocker")[0].style.display = "block";
        $("#bgvid")[0].style.opacity = 0;
        $(".subtitle_container")[0].style.display = "none";
        //console.log("Turned on casting")
    } else {
        $("#chromecast").removeClass("casting");
        $("#cast_blocker")[0].style.display = "none";
        $("#bgvid")[0].style.opacity = 1;
        $(".subtitle_container")[0].style.display = "";
        //console.log("Turned off casting")
    }
}

/**
 * Constants of states for Chromecast device
 *  - deviceState for Cast mode:
 *    IDLE: Default state indicating that Cast extension is installed, but showing no current activity
 *    ACTIVE: Shown when Chrome has one or more local activities running on a receiver
 *    WARNING: Shown when the device is actively being used, but when one or more issues have occurred
 *    ERROR: Should not normally occur, but shown when there is a failure
 **/
var DEVICE_STATE = {
    'IDLE': 0,
    'ACTIVE': 1,
    'WARNING': 2,
    'ERROR': 3
};

/**
 * Constants of states for CastPlayer
 **/
var PLAYER_STATE = {
    'IDLE': 'IDLE',
    'LOADING': 'LOADING',
    'LOADED': 'LOADED',
    'PLAYING': 'PLAYING',
    'PAUSED': 'PAUSED',
    'STOPPED': 'STOPPED',
    'SEEKING': 'SEEKING',
    'ERROR': 'ERROR'
};


(function () {
    'use strict';

    /**
     * Cast player object
     * main variables:
     *  - Cast player variables for controlling Cast mode media playback
     *  - Local player variables for controlling local mode media playbacks
     *  - Current media variables for transition between Cast and local modes
     */
    var CastPlayer = function () {
        /* device variables */
        // @type {DEVICE_STATE} A state for device
        this.deviceState = DEVICE_STATE.IDLE;

        /* receivers available */
        // @type {boolean} A boolean to indicate availability of receivers
        this.receivers_available = false;

        /* Cast player variables */
        // @type {Object} a chrome.cast.media.Media object
        this.currentMediaSession = null;
        // @type {Boolean} A flag for autoplay after load
        this.autoplay = true;
        // @type {string} a chrome.cast.Session object
        this.session = null;
        // @type {PLAYER_STATE} A state for Cast media player
        this.castPlayerState = PLAYER_STATE.IDLE;
        // @type {Boolean} Ensure auto-cast for a video in ... some cases :/
        this.first_load = false;
        // @type {Boolean} Keep from autoplaying a video in ... some cases :/
        this.manual_stop = false;

        /* Local player variables */
        // @type {PLAYER_STATE} A state for local media player
        this.localPlayerState = PLAYER_STATE.IDLE;
        // @type {HTMLElement} local player
        this.localPlayer = null;

        /* Current media variables */
        // @type {Boolean} Audio on and off
        this.audio = true;
        // @type {Number} A number for current media time
        this.currentMediaTime = 0;
        // @type {Number} A number for current media duration
        this.currentMediaDuration = -1;
        // @type {Timer} A timer for tracking progress of media
        this.timer = null;
        // @type {Boolean} A boolean to stop timer update of progress when triggered by media status event
        this.progressFlag = true;
        // @type {Number} A number in milliseconds for minimal progress update
        this.timerStep = 1000;

        this.initializeCastPlayer();
        this.initializeLocalPlayer();
    };

    /**
     * Initialize local media player
     */
    CastPlayer.prototype.initializeLocalPlayer = function () {
        this.localPlayer = document.getElementById('bgvid');
        this.localPlayer.addEventListener('loadeddata', this.onMediaLoadedLocally.bind(this));
    };

    /**
     * Initialize Cast media player
     * Initializes the API. Note that either successCallback and errorCallback will be
     * invoked once the API has finished initialization. The sessionListener and
     * receiverListener may be invoked at any time afterwards, and possibly more than once.
     */
    CastPlayer.prototype.initializeCastPlayer = function () {

        if (!chrome.cast || !chrome.cast.isAvailable) {
            setTimeout(this.initializeCastPlayer.bind(this), 1000);
            return;
        }
        var applicationID = chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID;

        // auto join policy can be one of the following three
        var autoJoinPolicy = chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED;
        //var autoJoinPolicy = chrome.cast.AutoJoinPolicy.PAGE_SCOPED;
        //var autoJoinPolicy = chrome.cast.AutoJoinPolicy.TAB_AND_ORIGIN_SCOPED;

        // request session
        var sessionRequest = new chrome.cast.SessionRequest(applicationID);
        var apiConfig = new chrome.cast.ApiConfig(sessionRequest,
            this.sessionListener.bind(this),
            this.receiverListener.bind(this),
            autoJoinPolicy);

        chrome.cast.initialize(apiConfig, this.onInitSuccess.bind(this), this.onError.bind(this));

        this.initializeUI();
    };

    /**
     * Callback function for init success
     */
    CastPlayer.prototype.onInitSuccess = function () {
        console.log("init success");
        this.updateMediaControlUI();
    };

    /**
     * Generic error callback function
     */
    CastPlayer.prototype.onError = function () {
        console.log("error");
    };

    /**
     * @param {!Object} e A new session
     * This handles auto-join when a page is reloaded
     * When active session is detected, playback will automatically
     * join existing session and occur in Cast mode and media
     * status gets synced up with current media of the session
     */
    CastPlayer.prototype.sessionListener = function (e) {
        this.session = e;
        if (this.session) {
            this.deviceState = DEVICE_STATE.ACTIVE;
            if (this.session.media[0]) {
                this.onMediaDiscovered('activeSession', this.session.media[0]);
                this.syncCurrentMedia(this.session.media[0].media.contentId);
            }
            else if (this.currentMediaSession || this.first_load) {
                this.first_load = false;
                this.loadMedia();
            }
            this.session.addUpdateListener(this.sessionUpdateListener.bind(this));
        }
    };

    /**
     * @param {string} currentMediaURL
     */
    CastPlayer.prototype.syncCurrentMedia = function (currentMediaURL) {
        for (var i = 0; i < video_obj.length; i++) {
            if (currentMediaURL.endsWith(video_obj[i]['file'])) {
                if (!block_cast_sync) vNum = i;
                retrieveNewVideo("sync");
            }
        }
        this.updateMediaControlUI();
    };

    /**
     * @param {string} e Receiver availability
     * This indicates availability of receivers but
     * does not provide a list of device IDs
     */
    CastPlayer.prototype.receiverListener = function (e) {
        if (e === 'available') {
            this.receivers_available = true;
            this.updateMediaControlUI();
            console.log("receiver found");
        }
        else {
            console.log("receiver list empty");
        }
    };

    /**
     * session update listener
     */
    CastPlayer.prototype.sessionUpdateListener = function (isAlive) {
        if (!isAlive) {
            this.session = null;
            this.deviceState = DEVICE_STATE.IDLE;
            this.castPlayerState = PLAYER_STATE.IDLE;
            this.currentMediaSession = null;
            clearInterval(this.timer);

            var online = navigator.onLine;
            if (online == true) {
                // continue to play media locally
                console.log("current time: " + this.currentMediaTime);
                this.localPlayerState = PLAYER_STATE.PLAYING;
                this.playMediaLocally();
            }
        }
        this.updateMediaControlUI();
    };

    /**
     * Requests that a receiver application session be created or joined. By default, the SessionRequest
     * passed to the API at initialization time is used; this may be overridden by passing a different
     * session request in opt_sessionRequest.
     */
    CastPlayer.prototype.launchApp = function () {
        console.log("launching app...");
        if (this.casting()) {
            console.log("Already casting, stopping media.");
            this.manual_stop = true;
            this.stopMedia();
        }
        else if (this.session) {
            console.log("Already have a session, playing media.");
            this.manual_stop = false;
            this.playMedia();
        } else {
            console.log("Don't have a session, requesting one.");
            this.manual_stop = false;
            this.first_load = true;
            chrome.cast.requestSession(
                this.sessionListener.bind(this),
                this.onLaunchError.bind(this));
        }
        if (this.timer) {
            clearInterval(this.timer);
        }
    };

    /**
     * Callback function for request session success
     * @param {Object} e A chrome.cast.Session object
     */
    CastPlayer.prototype.onRequestSessionSuccess = function (e) {
        console.log("session success: " + e.sessionId);
        this.session = e;
        this.deviceState = DEVICE_STATE.ACTIVE;
        this.updateMediaControlUI();
        this.loadMedia();
        this.session.addUpdateListener(this.sessionUpdateListener.bind(this));
    };

    /**
     * Callback function for launch error
     */
    CastPlayer.prototype.onLaunchError = function () {
        console.log("launch error");
        this.deviceState = DEVICE_STATE.ERROR;
    };

    /**
     * Stops the running receiver application associated with the session.
     */
    CastPlayer.prototype.stopApp = function () {
        this.session.stop(this.onStopAppSuccess.bind(this, 'Session stopped'),
            this.onError.bind(this));

    };

    /**
     * Callback function for stop app success
     */
    CastPlayer.prototype.onStopAppSuccess = function (message) {
        console.log(message);
        this.deviceState = DEVICE_STATE.IDLE;
        this.castPlayerState = PLAYER_STATE.IDLE;
        this.currentMediaSession = null;
        clearInterval(this.timer);

        // continue to play media locally
        console.log("current time: " + this.currentMediaTime);
        this.playMediaLocally();
        this.updateMediaControlUI();
    };

    /**
     * Loads media into a running receiver application
     */
    CastPlayer.prototype.loadMedia = function () {
        if (!this.session) {
            console.log("no session");
            return;
        }
        var video = getCurrentVideo();
        console.log("loading: " + video.title);

        var base_url = "http://" + window.location.hostname + "/";
        var mediaInfo = new chrome.cast.media.MediaInfo(base_url + "video/" + video.file);

        mediaInfo.metadata = new chrome.cast.media.GenericMediaMetadata();
        mediaInfo.metadata.metadataType = chrome.cast.media.MetadataType.GENERIC;
        mediaInfo.contentType = 'video/' + videoMIMEsubtype(video.file);

        mediaInfo.metadata.title = getCurrentVideoString();

        if (subsAvailable()) {
            var subTrack = new chrome.cast.media.Track(1,
                chrome.cast.media.TrackType.TEXT);
            subTrack.trackContentId = base_url + subtitlePath() + ".vtt";
            subTrack.trackContentType = "text/vtt";
            subTrack.subtype = chrome.cast.media.TextTrackType.SUBTITLES;
            subTrack.name = video.subtitles;
            mediaInfo.textTrackStyle = new chrome.cast.media.TextTrackStyle();
            mediaInfo.tracks = [subTrack];
        }

        var request = new chrome.cast.media.LoadRequest(mediaInfo);
        request.autoplay = this.autoplay;
        request.currentTime = this.localPlayer.currentTime;

        if (subsAvailable()) {
            request.activeTrackIds = [1];
        }
        if (!this.localPlayer.paused) {
            playPause("pause");
        }

        this.castPlayerState = PLAYER_STATE.LOADING;
        this.session.loadMedia(request,
            this.onMediaDiscovered.bind(this, 'loadMedia'),
            this.onLoadMediaError.bind(this));

        this.updateMediaControlUI();
    };

    /**
     * Callback function for loadMedia success
     * @param {Object} mediaSession A new media object.
     */
    CastPlayer.prototype.onMediaDiscovered = function (how, mediaSession) {
        console.log("new media session ID:" + mediaSession.mediaSessionId + ' (' + how + ')');
        this.currentMediaSession = mediaSession;
        if (how == 'loadMedia') {
            if (this.autoplay) {
                this.castPlayerState = PLAYER_STATE.PLAYING;
            }
            else {
                this.castPlayerState = PLAYER_STATE.LOADED;
            }
            this.manual_stop = false;
        }

        if (how == 'activeSession') {
            this.castPlayerState = this.session.media[0].playerState;
            this.currentMediaTime = this.session.media[0].currentTime;
        }

        if (this.castPlayerState == PLAYER_STATE.PLAYING) {
            // start progress timer
            this.startProgressTimer(this.incrementMediaTime);
        }

        this.currentMediaSession.addUpdateListener(this.onMediaStatusUpdate.bind(this));

        this.currentMediaDuration = this.currentMediaSession.media.duration;

        if (this.localPlayerState == PLAYER_STATE.PLAYING) {
            playPause("pause");
            // start progress timer
            this.startProgressTimer(this.incrementMediaTime);
        }
        // update UIs
        this.updateMediaControlUI();
    };

    /**
     * Callback function when media load returns error
     */
    CastPlayer.prototype.onLoadMediaError = function (e) {
        console.log("media error");
        console.log(e);
        this.castPlayerState = PLAYER_STATE.IDLE;
        // update UIs
        this.updateMediaControlUI();
    };

    /**
     * Callback function for media status update from receiver
     * @param {!Boolean} e true/false
     */
    CastPlayer.prototype.onMediaStatusUpdate = function (e) {
        if (e == false) {
            //this.currentMediaTime = 0;
            this.castPlayerState = PLAYER_STATE.IDLE;
            if (!this.manual_stop) retrieveNewVideo("idle_next");
        }
        this.currentMediaTime = this.currentMediaSession.currentTime;
        this.castPlayerState = this.currentMediaSession.playerState;
        //this.localPlayer.currentTime = this.currentMediaSession.currentTime;
        console.log("updating media");
        this.updateProgressBar(e);
        this.updateMediaControlUI();
    };

    /**
     * Helper function
     * Increment media current position by 1 second
     */
    CastPlayer.prototype.incrementMediaTime = function () {
        if (this.currentMediaSession.playerState == PLAYER_STATE.PLAYING || this.localPlayerState == PLAYER_STATE.PLAYING) {
            if (this.currentMediaTime < this.currentMediaDuration) {
                this.currentMediaTime += 1;
                this.updateProgressBarByTimer();
            }
            else {
                this.currentMediaTime = 0;
                clearInterval(this.timer);
            }
        }
        //console.log("++ " + this.currentMediaTime + " -> cast: " + this.castPlayerState + "; local: " + this.localPlayerState + "; session: " + this.currentMediaSession.playerState);
    };

    /**
     * Play media in local player
     */
    CastPlayer.prototype.playMediaLocally = function () {
        if (this.localPlayerState != PLAYER_STATE.PLAYING && this.localPlayerState != PLAYER_STATE.PAUSED) {
            this.localPlayer.src = "video/" + getCurrentVideo().file;
            this.localPlayer.load();
        }
        else {
            playPause("play");
        }
        this.updateMediaControlUI();
    };

    /**
     * Callback when media is loaded in local player
     */
    CastPlayer.prototype.onMediaLoadedLocally = function () {
        this.currentMediaDuration = this.localPlayer.duration;
        //this.localPlayer.currentTime = this.currentMediaTime;
    };

    CastPlayer.prototype.casting = function () {
        switch (this.castPlayerState) {
            case PLAYER_STATE.LOADED:
            case PLAYER_STATE.LOADING:
            case PLAYER_STATE.PAUSED:
            case PLAYER_STATE.PLAYING:
            case PLAYER_STATE.SEEKING:
                return true;
            default:
                return false;
        }
    };

    /**
     * Play media in Cast mode
     */
    CastPlayer.prototype.playMedia = function () {
        if (!this.session) {
            this.playMediaLocally();
            return;
        }

        switch (this.castPlayerState) {
            case PLAYER_STATE.LOADED:
            case PLAYER_STATE.PAUSED:
                this.currentMediaSession.play(null,
                    this.mediaCommandSuccessCallback.bind(this, "playing started for " + this.currentMediaSession.sessionId),
                    this.onError.bind(this));
                this.currentMediaSession.addUpdateListener(this.onMediaStatusUpdate.bind(this));
                this.castPlayerState = PLAYER_STATE.PLAYING;
                // start progress timer
                this.startProgressTimer(this.incrementMediaTime);
                break;
            case PLAYER_STATE.IDLE:
            case PLAYER_STATE.LOADING:
            case PLAYER_STATE.STOPPED:
                this.loadMedia();
                //this.currentMediaSession.addUpdateListener(this.onMediaStatusUpdate.bind(this));
                this.castPlayerState = PLAYER_STATE.PLAYING;
                break;
            default:
                break;
        }
        this.updateMediaControlUI();
    };

    /**
     * Pause media playback in Cast mode
     */
    CastPlayer.prototype.pauseMedia = function () {
        if (!this.currentMediaSession) {
            this.pauseMediaLocally();
            return;
        }

        if (this.castPlayerState == PLAYER_STATE.PLAYING) {
            this.castPlayerState = PLAYER_STATE.PAUSED;
            this.currentMediaSession.pause(null,
                this.mediaCommandSuccessCallback.bind(this, "paused " + this.currentMediaSession.sessionId),
                this.onError.bind(this));
            this.updateMediaControlUI();
            clearInterval(this.timer);
        }
    };

    /**
     * Pause media playback in local player
     */
    CastPlayer.prototype.pauseMediaLocally = function () {
        //this.localPlayer.pause();
        playPause("pause");
        this.updateMediaControlUI();
        clearInterval(this.timer);
    };

    /**
     * Stop media playback in either Cast or local mode
     */
    CastPlayer.prototype.stopMedia = function () {
        if (!this.currentMediaSession) {
            //this.stopMediaLocally();
            playPause("pause");
            return;
        }

        this.currentMediaSession.stop(null,
            this.mediaCommandSuccessCallback.bind(this, "stopped " + this.currentMediaSession.sessionId),
            this.onError.bind(this));
        this.castPlayerState = PLAYER_STATE.STOPPED;
        clearInterval(this.timer);
        playPause("play");

        this.updateMediaControlUI();
    };

    /**
     * Stop media playback in local player
     */
    CastPlayer.prototype.stopMediaLocally = function () {
        playPause("pause");
        this.localPlayerState = PLAYER_STATE.STOPPED;
        this.updateMediaControlUI();
    };

    /**
     * Set media volume in Cast mode
     * @param {Boolean} mute A boolean
     */
    CastPlayer.prototype.setReceiverVolume = function (mute) {
        if (!this.currentMediaSession) {
            return;
        }

        if (!mute) {
            this.session.setReceiverVolumeLevel(this.localPlayer.volume,
                this.mediaCommandSuccessCallback.bind(this),
                this.onError.bind(this));
        }
        else {
            this.session.setReceiverMuted(true,
                this.mediaCommandSuccessCallback.bind(this),
                this.onError.bind(this));
        }
        this.updateMediaControlUI();
    };

    CastPlayer.prototype.castPlayPause = function () {
        if (this.castPlayerState == PLAYER_STATE.PAUSED) {
            this.playMedia();
        } else if (this.castPlayerState == PLAYER_STATE.PLAYING) {
            this.pauseMedia();
        }
    };

    /**
     * Mute media function in either Cast or local mode
     */
    CastPlayer.prototype.muteMedia = function () {
        if (this.audio == true) {
            this.audio = false;
            if (this.currentMediaSession) {
                this.setReceiverVolume(true);
            }
            else {
                this.localPlayer.muted = true;
            }
        }
        else {
            this.audio = true;
            if (this.currentMediaSession) {
                this.setReceiverVolume(false);
            }
            else {
                this.localPlayer.muted = false;
            }
        }
        this.updateMediaControlUI();
    };


    /**
     * media seek function in either Cast or local mode
     * @param {Event} e An event object from seek
     */
    CastPlayer.prototype.seekMedia = function (event) {
        const video = document.getElementById("bgvid");
        var timeToSkip = event;
        const percentage = video.duration / timeToSkip;

        if (this.castPlayerState != PLAYER_STATE.PLAYING && this.castPlayerState != PLAYER_STATE.PAUSED) {
            return;
        }

        this.currentMediaTime = timeToSkip;
        console.log('Seeking ' + this.currentMediaSession.sessionId + ':' +
            this.currentMediaSession.mediaSessionId + ' to ' + percentage + "%");
        var request = new chrome.cast.media.SeekRequest();
        request.currentTime = this.currentMediaTime;
        this.currentMediaSession.seek(request,
            this.onSeekSuccess.bind(this, 'media seek done'),
            this.onError.bind(this));
        this.castPlayerState = PLAYER_STATE.SEEKING;

        this.updateMediaControlUI();
    };

    /**
     * Callback function for seek success
     * @param {String} info A string that describe seek event
     */
    CastPlayer.prototype.onSeekSuccess = function (info) {
        console.log(info);
        this.castPlayerState = PLAYER_STATE.PLAYING;
        this.updateMediaControlUI();
    };

    /**
     * Callback function for media command success
     */
    CastPlayer.prototype.mediaCommandSuccessCallback = function (info, e) {
        console.log(info);
    };

    /**
     * Update progress bar when there is a media status update
     * @param {Object} e An media status update object
     */
    CastPlayer.prototype.updateProgressBar = function (e) {
        var p = document.getElementById("timeprogress");
        if (e == false) {
            p.style.width = '0px';
            clearInterval(this.timer);
            this.castPlayerState = PLAYER_STATE.STOPPED;
        } else {
            p.style.width = 100 * (this.currentMediaSession.currentTime / this.currentMediaSession.media.duration) + '%';
            this.progressFlag = false;
            setTimeout(this.setProgressFlag.bind(this), 1000); // don't update progress in 1 second
            //this.localPlayer.currentTime = this.currentMediaSession.currentTime;
        }
    };

    /**
     * Set progressFlag with a timeout of 1 second to avoid UI update
     * until a media status update from receiver
     */
    CastPlayer.prototype.setProgressFlag = function () {
        this.progressFlag = true;
    };

    /**
     * Update progress bar based on timer
     */
    CastPlayer.prototype.updateProgressBarByTimer = function () {
        var p = document.getElementById("timeprogress");
        if (isNaN(parseInt(p.style.width))) {
            p.style.width = 0;
            this.localPlayer.currentTime = 0;
        }
        if (this.currentMediaDuration > 0) {
            var pp = 100 * (this.currentMediaTime / this.currentMediaDuration);
        }

        if (this.progressFlag) {
            // don't update progress if it's been updated on media status update event
            p.style.width = pp + '%';
            //this.localPlayer.currentTime = this.currentMediaTime;
        }

        if (pp > 100) {
            clearInterval(this.timer);
            this.deviceState = DEVICE_STATE.IDLE;
            this.castPlayerState = PLAYER_STATE.IDLE;
            this.updateMediaControlUI();
        }
    };

    /**
     * Update media control UI components based on localPlayerState or castPlayerState
     */
    CastPlayer.prototype.updateMediaControlUI = function () {
        var playerState = this.deviceState == DEVICE_STATE.ACTIVE ? this.castPlayerState : this.localPlayerState;
        switch (playerState) {
            case PLAYER_STATE.LOADED:
            case PLAYER_STATE.PLAYING:
                mediaStatePlaying(true);
                break;
            case PLAYER_STATE.PAUSED:
            case PLAYER_STATE.IDLE:
            case PLAYER_STATE.LOADING:
            case PLAYER_STATE.STOPPED:
                mediaStatePlaying(false);
                break;
            default:
                break;
        }

        if (!this.receivers_available) {
            showCastButton(false);
            return;
        }
        showCastButton(true);

        if (this.casting()) {
            showCastState(true);
        }
        else {
            showCastState(false);
        }
    };

    /**
     * Initialize UI components and add event listeners
     */
    CastPlayer.prototype.initializeUI = function () {
        //document.getElementById("progressbar").addEventListener('click', this.seekMedia.bind(this));
    };

    /**
     * @param {function} A callback function for the function to start timer
     */
    CastPlayer.prototype.startProgressTimer = function (callback) {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }

        // start progress timer
        this.timer = setInterval(callback.bind(this), this.timerStep);
    };

    window.CastPlayer = CastPlayer;
})();

var myCastPlayer = new CastPlayer();

