var castEnabled = false;

var castSession = null;
var currentMedia = null;

var timer = null;
var progressFlag = true;
var timerStep = 1000;

function startProgressTimer(callback) {
    if( timer ) {
        clearInterval(timer);
        timer = null;
    }

    // start progress timer
    timer = setInterval(callback.bind(this), timerStep);
};

function onRequestSessionSuccess(session) {
    castSession = session;
    var remoteMedia = castSession.media[castSession.media.length-1];
    var video = $("#bgvid")[0];
    var url = video.currentSrc;
    var file = url.split('?')[0];
    var type = file.substr(file.lastIndexOf('.') + 1) || "webm"; // Default to MP4
    var mediaInfo = new chrome.cast.media.MediaInfo(url, "video/" + type);
    mediaInfo.streamType = chrome.cast.media.StreamType.LIVE;
    var request = new chrome.cast.media.LoadRequest(mediaInfo);
    console.log("Loading " + url);
    return session.loadMedia(request,
            onMediaDiscovered.bind(this, 'loadMedia'),
            onMediaError);
};

function onMediaDiscovered(how, media) {
    playPause("pause")
    console.log(media);
    media.addUpdateListener(onMediaStatusUpdate);
    currentMedia = media;
};

function onMediaStatusUpdate(e) {
    console.log(e);
}

function onMediaError(e) {
    castEnabled = false;
    console.log(e);
};

function onLaunchError(e) {
    castEnabled = false;
    console.log(e);
};

function onInitError(e) {
    castEnabled = false;
    console.log(e);
};

function sessionListener(e) {
    console.log(e);
    castSession = e;
    if (castSession.status == chrome.cast.SessionStatus.CONNECTED) {
        playPause("pause");
        enableCast(true);
    } else {
        enableCast(false);
    }
};

function enableCast(force) {
    if (force != undefined) castEnabled = force;
    else castEnabled = !castEnabled;

    if (castEnabled) {
        castVideo();
    } else if (castSession != null) {
        castSession.stop()
        playPause("play");
    }
    showCastState();
}

function showCastState() {
    if (castEnabled) {
        $("#chromecast").addClass("casting")
    } else {
        $("#chromecast").removeClass("casting")
    }
}

function castVideo() {
    var video = $("#bgvid")[0];
    console.log("Casting " + video.currentSrc);
    if (castSession !== null) {
        onRequestSessionSuccess(castSession);
    } else {
        chrome.cast.requestSession(onRequestSessionSuccess, onLaunchError);
    }
}

function showCastButton() {
    $("#chromecast")[0].hidden = false;
}

function castPlayPause(force) {
    if (!currentMedia) return;
    action = null;
    if (force != undefined) {
        action = force;
    } else if (currentMedia.playerState == "PLAYING") {
        action = "pause";
    } else if (currentMedia.playerState == "PAUSED") {
        action = "play";
    }

    if (action == "play" && currentMedia.playerState != "PLAYING") {
        currentMedia.play();
    } else if (action == "pause" && currentMedia.playerState != "PAUSED") {
        currentMedia.pause();
    }
}

function castSeek(time) {
    if (!currentMedia) return;
    var request = new chrome.cast.media.SeekRequest();
    request.currentTime = time;
    currentMedia.seek(request);
}

function receiverListener(e) {
    if (e == chrome.cast.ReceiverAvailability.AVAILABLE) {
        console.log("Receiver available?");
        showCastButton();
    } else {
        console.log("No available receivers");
    }
};

function onInitSuccess(e) {
    console.log('Initialized Chromecast API');
};

function initializeCastApi() {
    var sessionRequest = new chrome.cast.SessionRequest(chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID);
    var apiConfig = new chrome.cast.ApiConfig(sessionRequest, sessionListener, receiverListener);
    chrome.cast.initialize(apiConfig, onInitSuccess, onInitError);
};

window['__onGCastApiAvailable'] = function(loaded, errorInfo) {
    if (loaded) {
        initializeCastApi();
    } else {
        console.log(errorInfo);
    }
}
