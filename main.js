/* Contributors:
   Howl - Video Autonext
   Yurifag_ ( https://twitter.com/Yurifag_/ ) - Video Progress Bar
   trac - Video Progress Bar Seeking
   Tom McFarlin ( http://tommcfarlin.com ) - Konami Code
   Yay295 - Tooltip Function, Openings-Only Button, window.history, Mouse Idle, and Other Things
   givanse ( http://stackoverflow.com/a/23230280 ) - Mobile Swipe Detection
   maj160 - Fullscreen Functions, Subtitle Renderer
   aty2 - Menu toggle keyboard button
   */

// Global Variables
var vNum = 0, video_obj = [];
var autonext = true;
var xDown = null, yDown = null; // position of mobile swipe start location
var mouseIdle, lastMousePos = {"x":0,"y":0};
var storageSupported = false;
var initial = true;

function empty(thing) {
    if (typeof thing == "object" && thing.length > 0) return false;
    return true;
}

function getCurrentVideo() {
    return video_obj[vNum];
}

function basename() { return getCurrentVideo().file.replace(/\.\w+$/, ""); }
function title() { return getCurrentVideo().title; }
function editor() { return getCurrentVideo().editor; }
function subtitlePath() { return "subtitles/" + basename() + ".ass"; }
function isTouchDevice() { return (('ontouchstart' in window) || (navigator.MaxTouchPoints > 0) || (navigator.msMaxTouchPoints > 0)); }

window.onload = function() {
    var video_name_passed = $.urlParam("video");
    var playlist_passed = history.state && history.state.playlist == true;
    var history_exists = history.state && !empty(history.state.list);

    var site_state;
    if (video_name_passed) site_state = "video_link";
    else if (playlist_passed) site_state = "playlist";
    else if (history_exists && !playlist_passed) site_state = "return_visit"; // redundant but READABLE check on playlist_passed
    else site_state = "new_visit";
    console.log("Site state: " + site_state);

    switch (site_state) {
        // If this is a new visitor, need to get a video list and autoplay
        case "new_visit":
            // Same thing for a link
        case "video_link":
            getVideolist();
            break;
            // For a playlist, we need to get the list from history
        case "playlist":
            console.log("Playlist found:");
            console.log("\t" + getPlaylistVideoStrings());
            popHist();
            break;
            // For a return visit, we need to get the last video from history
        case "return_visit":
            console.log("Returning to the site, left off with:")
                console.log("\t" + getCurrentVideoString());
            popHist();
            break;
    }

    const video = document.getElementById("bgvid");

    // Fix menu button. It is set in HTML to be a link to the FAQ page for anyone who has disabled JavaScript.
    document.getElementById("menubutton").outerHTML = '<span id="menubutton" class="quadbutton fa fa-bars" onclick="showMenu()"></span>';

    try { if ("localStorage" in window && window["localStorage"] !== null) storageSupported = true; } catch(e) { }
    if (storageSupported) {
        if (window.localStorage["autonext"] == "true" && autonext != true) toggleAutonext();
        else if (window.localStorage["autonext"] == "false" && autonext != false) toggleAutonext();
    }

    // Pause/Play video on click event listener
    video.addEventListener("click", playPause);

    /* The 'ended' event does not fire if loop is set. We want it to fire, so we
       need to remove the loop attribute. We don't want to remove loop from the base
       html so that it does still loop for anyone who has disabled JavaScript. */
    video.removeAttribute("loop");

    // Progress bar event listeners
    video.addEventListener("progress", updateprogress); // on video loading progress
    video.addEventListener("timeupdate", updateprogress);
    video.addEventListener("timeupdate", updateplaytime); // on time progress

    // Progress bar seeking
    $(document).on("click", "#progressbar", function(e) {
            const percentage = e.pageX / $(document).width();
            skip((video.duration * percentage) - video.currentTime);
            if (castEnabled) castSeek();
            });

    // Mobile swipe event listeners
    document.addEventListener("touchstart", handleTouchStart);
    document.addEventListener("touchmove", handleTouchMove);

    // Mouse wheel functions
    const wheelEvent = isEventSupported("wheel") ? "wheel" : "mousewheel";
    $(document).on(wheelEvent, function(e) {
            const oEvent = e.originalEvent;
            const delta  = oEvent.deltaY || oEvent.wheelDelta;
            if (delta > 0) // Scrolled down
            changeVolume(-0.05);
            else if (delta < 0) // Scrolled up
            changeVolume(0.05);
            });

    // Mouse move event listener
    document.addEventListener("mousemove", aniopMouseMove);

    // Tooltip event listeners
    $("#menubutton").hover(tooltip);
    $(".controlsleft").children().hover(tooltip);
    $(".controlsright").children().hover(tooltip);

    // Fullscreen change event listeners
    document.addEventListener("fullscreenchange", aniopFullscreenChange);
    document.addEventListener("webkitfullscreenchange", aniopFullscreenChange);
    document.addEventListener("mozfullscreenchange", aniopFullscreenChange);
    document.addEventListener("MSFullscreenChange", aniopFullscreenChange);
};

function getPlaylistVideoStrings() {
    var playlist = history.state.list;
    var video_strings = [];
    for (var item in playlist) {
        var video = playlist[item];
        video_strings.push(buildVideoString(video));
    }
    return video_strings;
}

function getCurrentVideoString() {
    var video = history.state.list[history.state.video];
    return buildVideoString(video);
}

function buildVideoString(video) {
    return "'" + video.title + "' by " + video.editor;
}

window.onpopstate = popHist;
function popHist() {
    console.log("Popping history")
        initial = false;
    if (history.state == "list") {
        history.go();
    }

    if (history.state.list == "") {
        vNum = 0;
        video_obj = history.state.video;
    } else {
        vNum = history.state.video;
        video_obj = history.state.list;
    }
    setVideoElements();
    resetSubtitles();
    toggleSubs();
    playPause();
    ++vNum;
}

// Hide mouse, progress bar, and controls if mouse has not moved for 3 seconds
// and the menu is not open. Will not hide the tooltip or a button that is
// being hovered over.
function aniopMouseMove(event) {
    // If it is not a mobile device.
    if (xDown == null)
    {
        $(".quadbutton").addClass("quadNotMobile");

        // If the mouse has actually moved.
        if (event.clientX != lastMousePos.x || event.clientY != lastMousePos.y)
        {
            clearTimeout(mouseIdle);

            document.getElementsByTagName("html")[0].style.cursor = "";
            $("#progressbar").removeClass("mouse-idle");
            $("#menubutton").removeClass("mouse-idle");
            $("#chromecast").removeClass("mouse-idle");
            $(".controlsleft").children().removeClass("mouse-idle");
            $(".controlsright").children().removeClass("mouse-idle");

            // If the menu is not open.
            if (document.getElementById("site-menu").hasAttribute("hidden")) {
                mouseIdle = setTimeout(function() {
                        $("#progressbar").addClass("mouse-idle");
                        $("#menubutton").addClass("mouse-idle");
                        $("#chromecast").addClass("mouse-idle");
                        $(".controlsleft").children().addClass("mouse-idle");
                        $(".controlsright").children().addClass("mouse-idle");
                        document.getElementsByTagName("html")[0].style.cursor = "none";
                        }, 3000);
            }

            lastMousePos = {"x":event.clientX,"y":event.clientY};
        }
    }
}

// get shuffled list of videos with current video first
function getVideolist() {
    document.getElementById("bgvid").setAttribute("hidden", "");
    //tooltip("Loading...", "bottom: 50%; left: 50%; bottom: calc(50% - 16.5px); left: calc(50% - 46.5px); null");

    $.getJSON("/videos.json", finishGettingVideolist);
}

function finishGettingVideolist(fetched_json) {

    video_obj = [];
    for (var editor_name in fetched_json) {
        var editor = fetched_json[editor_name];
        for (var video_name in editor) {
            var video = editor[video_name];
            video.editor = editor_name;
            video.title = video_name;
            video_obj.push(video);
        }
    }
    shuffleArray(video_obj);
    vNum = 1;

    //tooltip();
    if (initial) {
        initial = false;
        if ($.urlParam("video")) {
            vNum = findVideoByFile($.urlParam("video"));
            retrieveNewVideo();
        } else {
            retrieveNewVideo();
        }
    }
    document.getElementById("bgvid").removeAttribute("hidden");
}

function findVideoByFile(file) {
    for (var video in video_obj) {
        if (video_obj[video]["file"].startsWith(file))
            return video;
    }
}

function shuffleArray(array) {
    for (var i = array.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = array[i];
        array[i] = array[j];
        array[j] = temp;
    }
    return array;
}

function retrieveNewVideo() {
    if (video_obj.length <= 1) getVideolist();

    // just in case
    if (video_obj.length == 0) return;
    if (vNum >= video_obj.length) vNum = 0;

    // When the end of the list is reached, go back to the beginning. Only do this once per function call.
    for (var start = vNum, end = video_obj.length, counter = 2; counter > 0; --counter) {
        if (vNum >= end) {
            vNum = 0;
            end = start
        } else break;
    }

    setVideoElements();

    history.pushState({video: vNum, list: video_obj}, document.title, location.origin + location.pathname);

    resetSubtitles();
    toggleSubs();
    var video = video_obj[vNum];
    document.title = video.title + " by " + video.editor;
    console.log("--> Playing from retrieveNewVideo:");
    console.log("\t" + getCurrentVideoString());
    document.getElementById("bgvid").play();
    document.getElementById("pause-button").classList.remove("fa-play");
    document.getElementById("pause-button").classList.add("fa-pause");

    ++vNum;

    if (typeof run_analytics == 'function') run_analytics();
    if (typeof castVideo == 'function') castVideo();
}

function setVideoElements() {
    function videoMIMEsubtype(filename) {
        filename = filename.replace(filename.replace(/\.\w+$/, ""), "");
        switch (filename) {
            case ".mp4":
            case ".m4v":
                return "mp4";
            case ".ogg":
            case ".ogm":
            case ".ogv":
                return "ogg";
            case ".webm":
                return "webm";
            default:
                return "*";
        }
    }

    const video = video_obj[vNum];

    var source_element = document.getElementsByTagName("source");
    if (source_element.length === 0) {
        var video_element = document.getElementsByTagName("video")[0];
        source_element = document.createElement("source");
        source_element.src = "video/" + video.file;
        source_element.type = "video/" + videoMIMEsubtype(video.file);
        video_element.appendChild(source_element);
    } else {
        source_element = source_element[0];
    }

    source_element.src = "video/" + video.file;
    source_element.type = "video/" + videoMIMEsubtype(video.file);
    document.getElementById("bgvid").load();
    document.getElementById("subtitle-attribution").innerHTML = (video.subtitles ? "[" + video.subtitles + "]" : "");
    document.title = video.title + " by " + video.editor;
    document.getElementById("title").innerHTML = video.title;
    document.getElementById("editor").innerHTML = "Editor: " + video.editor;
    document.getElementById("videolink").parentNode.removeAttribute("hidden");
    document.getElementById("videodownload").parentNode.removeAttribute("hidden");
    document.getElementById("videolink").href = "/?video=" + video.file.replace(/\.\w+$/, "");
    document.getElementById("videodownload").href = "video/" + video.file;


    var song = "";
    if (video.song) {
        song = "Song: &quot;" + video.song.title + "&quot; by " + video.song.artist;
    }
    document.getElementById("song").innerHTML = song;

    // Set button to show play icon.
    $("#pause-button").removeClass("fa-pause").addClass("fa-play");
}

// Menu Visibility Functions
function menuIsHidden() {
    return document.getElementById("site-menu").hasAttribute("hidden");
}
function showMenu() {
    if (xDown != null) tooltip(); // Hide the tooltip on mobile.
    clearTimeout(mouseIdle); // Stop things from being hidden on idle.
    $("#menubutton").hide();
    document.getElementById("site-menu").removeAttribute("hidden");
}
function hideMenu() {
    if (xDown != null) tooltip(); // Hide the tooltip on mobile.
    $("#menubutton").show();
    document.getElementById("site-menu").setAttribute("hidden", "");
}
function toggleMenu() {
    if (menuIsHidden()) showMenu();
    else hideMenu();
}

// Play/Pause Button
function playPause(force) {
    if (arguments.callee.caller)
        console.log("Called playPause: " + arguments.callee.caller.name);
    else if (!empty(arguments) && typeof arguments[0] == 'object')
        console.log("Triggered playPause: " + arguments[0].constructor.name);
    if (force instanceof MouseEvent) force = undefined;

    const video = $("#bgvid")[0];

    if (force != undefined) action = force;
    else if (video.paused) action = "play";
    else action = "pause";

    if (typeof(castEnabled) != "undefined" && castEnabled && force == undefined) {
        console.log("--> Passing to castPlayPause()");
        castPlayPause();
    } else if (action == "play") {
        console.log("--> Playing from playPause");
        video.play();
        mediaStatePlaying(true);
    } else {
        console.log("--> Pausing from playPause");
        video.pause();
        mediaStatePlaying(false);
    }

    // Toggle Tooltip
    //tooltip();
    //tooltip("pause-button");

}

function mediaStatePlaying(state) {
    if (state) { // Playing!
        // Toggle Play/Pause Icon
        $("#pause-button").removeClass("fa-play").addClass("fa-pause");
    } else { // Paused!
        // Toggle Play/Pause Icon
        $("#pause-button").addClass("fa-play").removeClass("fa-pause");
    }
}

// Video Seek Function
function skip(value) {
    // Retrieves the video's DOM object, and then adds to the current
    // position in time the value given by the function parameters.
    const video = document.getElementById("bgvid");
    video.currentTime += value;

    // Calculates the current time in minutes and seconds.
    const minutes = Math.floor(video.currentTime / 60);
    const seconds = Math.floor(video.currentTime - (60 * minutes));

    // Displays the current time.
    displayTopRight(minutes + ":" + (seconds < 10 ? "0" : "") + seconds);
}

// Fullscreen Functions
function isFullscreen() {
    return Boolean(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
}
function toggleFullscreen() {
    if (isFullscreen()) {
        if (document.exitFullscreen) document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
        else if (document.mozCancelFullScreen) document.mozCancelFullScreen();
        else if (document.msExitFullscreen) document.msExitFullscreen();
    } else {
        const e = document.getElementsByTagName("html")[0];
        if (e.requestFullscreen) e.requestFullscreen();
        else if (e.webkitRequestFullscreen) e.webkitRequestFullscreen();
        else if (e.mozRequestFullScreen) e.mozRequestFullScreen();
        else if (e.msRequestFullscreen) e.msRequestFullscreen();
    }

    // Toggle Tooltip
    tooltip();
    tooltip("fullscreen-button");
}
function aniopFullscreenChange() {
    var button = document.getElementById("fullscreen-button");

    if (isFullscreen()) {
        button.classList.remove("fa-expand");
        button.classList.add("fa-compress");
    } else {
        button.classList.remove("fa-compress");
        button.classList.add("fa-expand");
    }
}

// Autonext by Howl
function toggleAutonext() {
    autonext = !autonext;
    if (autonext) {
        $("#autonext").removeClass("fa-toggle-off").addClass("fa-toggle-on");
        document.getElementById("bgvid").removeAttribute("loop");
    } else {
        $("#autonext").removeClass("fa-toggle-on").addClass("fa-toggle-off");
        document.getElementById("bgvid").setAttribute("loop", "");
    }

    if (storageSupported) window.localStorage["autonext"] = autonext;

    // Toggle Tooltip
    tooltip();
    tooltip("autonext");
}

// what to do when the video ends
function onend() {
    if (autonext) retrieveNewVideo();
    else {
        console.log("--> Playing from onend")
            document.getElementById("bgvid").play(); // loop
    }
}

// Overused tooltip code
function tooltip(text, css) {
    if (isTouchDevice()) return;
    var eventType;
    if (text && text.target) {
        eventType = text.type;
        text = text.target.id;
    }

    switch (text) {
        case "menubutton":
            text = "Menu (M)";
            css = "top: 65px; bottom: auto; left";
            break;
        case "getnewvideo":
            text = "Click to get a new video (N)";
            css = "left";
            break;
        case "autonext":
            if (autonext) text = "Click to loop video instead of getting a new one";
            else text = "Click to get a new video instead of looping";
            css = "left";
            break;
        case "skip-left":
            text = "Click to go back 10 seconds (left arrow)";
            css = "right";
            break;
        case "skip-right":
            text = "Click to go forward 10 seconds (right arrow)";
            css = "right";
            break;
        case "pause-button":
            if (!document.getElementById("bgvid").paused) text = "Click to pause the video (spacebar)";
            else text = "Click to play the video (spacebar)";
            css = "right";
            break;
        case "fullscreen-button":
            if(isFullscreen()) text = "Click to exit fullscreen (F)";
            else text = "Click to enter fullscreen (F)";
            css = "right";
            break;
        case "subtitles-button":
            if(subsOn()) text = "Click to disable subtitles (S)";
            else text = "Click to enable subtitles (S)";
            css = "right";
            break;
        case undefined:
            return;
    }

    const element = document.getElementById("tooltip");
    element.removeAttribute("style");
    if (css != "") element.setAttribute("style", css + ": 10px;");
    element.innerHTML = text;
    element.classList.toggle("is-hidden", eventType && eventType === "mouseleave");
    element.classList.toggle("is-visible", eventType && eventType === "mouseenter");
}

// Keyboard functions
$(document).keydown(function(e) {
        switch(e.which) {
        case 32: // Space
        playPause();
        break;
        case 33: // Page Up
        changeVolume(0.05);
        break;
        case 34: // Page Down
        changeVolume(-0.05);
        break;
        case 37: // Left Arrow
        skip(-10);
        break;
        case 39: // Right Arrow
        skip(10);
        break;
        case 70: // F
        case 122: // F11
        toggleFullscreen();
        break;
        case 77: // M
        toggleMenu();
        break;
        case 78: // N
        retrieveNewVideo();
        break;
        case 83: // S
        toggleSubs();
        break;
        default:
        return;
        }
        e.preventDefault();
});

// checks if an event is supported
function isEventSupported(eventName) {
    const el = document.createElement("div");
    eventName = "on" + eventName;
    var isSupported = (eventName in el);

    if (!isSupported) {
        el.setAttribute(eventName, "return;");
        isSupported = typeof el[eventName] === "function";
    }

    return isSupported;
}

// change volume
function changeVolume(amount) {
    const video = document.getElementById("bgvid");
    if (video.volume > 0 && amount < 0)
        video.volume = (video.volume + amount).toPrecision(2);
    else if (video.volume < 1 && amount > 0)
        video.volume = (video.volume + amount).toPrecision(2);

    var percent = (video.volume * 100);
    if (video.volume < 0.1)
        percent = percent.toPrecision(1);
    else if (video.volume == 1)
        percent = percent.toPrecision(3);
    else
        percent = percent.toPrecision(2);

    displayTopRight(percent + "%");

    if (typeof(setCastVolume) != "undefined") {
        setCastVolume(video.volume);
    }
}

// display text in the top right of the screen
function displayTopRight(text,delay) {
    const disp = $(".displayTopRight");
    disp.stop(true,true);
    disp.text(text);
    disp.show();
    disp.delay(delay?delay:0).fadeOut(1000);
}

// set video progress bar buffered length
function updateprogress() {
    const video = document.getElementById("bgvid"); // get video element
    const buffered = ((video.buffered && video.buffered.length) ? 100 * (video.buffered.end(0) / video.duration) : (video.readyState == 4 ? 100 : 0)); // calculate buffered data in percent
    document.getElementById("bufferprogress").style.width = buffered + "%"; // update progress bar width
}

// set video progress bar played length
function updateplaytime() {
    const video = document.getElementById("bgvid"); // get video element
    const watched = 100 * (video.currentTime / video.duration); // calculate current time in percent
    document.getElementById("timeprogress").style.width = watched + "%"; // update progress bar width
}

// get mobile swipe start location
function handleTouchStart(evt) {
    xDown = evt.touches[0].clientX;
    yDown = evt.touches[0].clientY;
}

// handle mobile swipe
function handleTouchMove(evt) {
    if (!xDown && !yDown) return;

    const xDiff = xDown - evt.touches[0].clientX;
    const yDiff = yDown - evt.touches[0].clientY;

    // detect swipe in the most significant direction
    if (Math.abs(xDiff) > Math.abs(yDiff)) {
        if (xDiff > 0) {
            /* left swipe */
        } else {
            /* right swipe */
        }
    } else {
        if (yDiff > 0) {
            /* up swipe */
            $(".progress").height(2);
        } else {
            /* down swipe */
            $(".progress").height(15);
        }
    }

    // reset values
    xDown = null;
    yDown = null;
}

// Subtitle Funtions
function getSubtitleAttribution() {
    return document.getElementById("subtitle-attribution").textContent;
}
function subsAvailable() {
    return Boolean(getCurrentVideo().subtitles)
}
function subsOn() {
    return Boolean(document.getElementById("bgvid").subtitles);
}
function resetSubtitles() {
    if (subsAvailable()) {
        $("#subtitles-button").show();
        $("#subs").show();
        var temp = document.getElementById("wrapper").children;
        if (subsOn()) initializeSubtitles(temp[0], temp[1], subtitlePath());
    } else {
        $("#subtitles-button").hide();
        $("#subs").hide();
        if (subsOn()) {
            removeSubtitles(document.getElementById("bgvid"));
            document.getElementById("bgvid").subtitles = "Not available"; // Must be defined to flag that subtitles are toggled on
        }
    }
}
function toggleSubs() {
    if (subsAvailable()) {
        if (subsOn()) {
            $("#subtitles-button").addClass("fa-commenting-o").removeClass("fa-commenting");
            removeSubtitles(document.getElementById("bgvid"));
            displayTopRight("Disabled Subtitles", 1000);
        } else {
            $("#subtitles-button").addClass("fa-commenting").removeClass("fa-commenting-o");
            var temp = document.getElementById("wrapper").children;
            initializeSubtitles(temp[0], temp[1], subtitlePath());
            displayTopRight("Enabled Subtitles by " + getSubtitleAttribution(), 3000);
        }
    }
}
function initializeSubtitles(subContainer, videoElem, subFile) {
    removeSubtitles(videoElem);
    videoElem.subtitles = new subtitleRenderer(subContainer, videoElem, subFile);
}
function removeSubtitles(videoElem) {
    if(subsOn() && videoElem.subtitles.shutItDown) {
        videoElem.subtitles.shutItDown();
        videoElem.subtitles = null;
    }
}

$.urlParam = function(name){
    var results = new RegExp('[\?&]' + name + '=([^&#]*)').exec(window.location.href);
    if (results) return results[1];
    else return undefined;
}
