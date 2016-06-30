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
var keylog = [];
var vNum = 0, video_obj = [];
var autonext = false;
var OPorED = "all"; // egg, op, ed, all
var xDown = null, yDown = null; // position of mobile swipe start location
var mouseIdle, lastMousePos = {"x":0,"y":0};
var storageSupported = false;

function filename() { return document.getElementsByTagName("source")[0].src.split("video/")[1].replace(/\.\w+$/, ""); }
function fileext() { return document.getElementsByTagName("source")[0].src.split("video/")[1].replace(filename(), ""); }
function title() { return document.getElementById("title").textContent.trim(); }
function source() { return document.getElementById("source").textContent.trim().slice(8); }
function subtitlePath() { return "subtitles/" + filename() + ".ass"; }

window.onload = function() {
  // Fix menu button. It is set in HTML to be a link to the FAQ page for anyone who has disabled JavaScript.
  document.getElementById("menubutton").outerHTML = '<span id="menubutton" class="quadbutton fa fa-bars" onclick="showMenu()"></span>';

  // Set/Get history state
  if (history.state == null) {
    if (document.title == "Secret~") history.replaceState({video: "Egg", list: []}, document.title, location.origin + location.pathname);
    else {
      var state = {file: filename() + fileext(), source: source(), title: title()};
      document.title = state.title + " from " + state.source;
      if (document.getElementById("song").innerHTML) { // We know the song info
        var info = document.getElementById("song").innerHTML.replace("Song: \"","").split("\" by ");
        state.song = {title: info[0], artist: info[1]};
      }
      if ($("#subtitles-button").is(":visible")) // Subtitles are available
        state.subtitles = getSubtitleAttribution().slice(1,-1);
      history.replaceState({video: [state], list: []}, document.title, location.origin + location.pathname + (location.search ? "?video=" + filename() : ""));
    }
  } else popHist();

  try { if ("localStorage" in window && window["localStorage"] !== null) storageSupported = true; } catch(e) { }
  if (storageSupported) {
    if (window.localStorage["autonext"] == "true") toggleAutonext();
  }

  const video = document.getElementById("bgvid");

  // autoplay
  if (video.paused) playPause();

  // Pause/Play video on click event listener
  video.addEventListener("click", playPause);

  /* The 'ended' event does not fire if loop is set. We want it to fire, so we
  need to remove the loop attribute. We don't want to remove loop from the base
  html so that it does still loop for anyone who has disabled JavaScript. */
  video.removeAttribute("loop");

  // Progress bar event listeners
  video.addEventListener("progress", updateprogress); // on video loading progress
  video.addEventListener("timeupdate", updateplaytime); // on time progress

  // Progress bar seeking
  $(document).on("click", "#progressbar", function(e) {
    const percentage = e.pageX / $(document).width();
    skip((video.duration * percentage) - video.currentTime);
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

window.onpopstate = popHist;
function popHist() {
  if (history.state == "list") history.go();

  if (history.state.list == "") {
    if (history.state.video == "Egg") getVideolist();
    else {
      vNum = 0;
      video_obj = history.state.video;
    }
  } else {
    vNum = history.state.video;
    video_obj = history.state.list;
  }
  setVideoElements();
  resetSubtitles();
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
      $(".controlsleft").children().removeClass("mouse-idle");
      $(".controlsright").children().removeClass("mouse-idle");

      // If the menu is not open.
      if (document.getElementById("site-menu").hasAttribute("hidden")) {
        mouseIdle = setTimeout(function() {
          $("#progressbar").addClass("mouse-idle");
          $("#menubutton").addClass("mouse-idle");
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
  tooltip("Loading...", "bottom: 50%; left: 50%; bottom: calc(50% - 16.5px); left: calc(50% - 46.5px); null");

  $.ajaxSetup({async: false});
  $.getJSON("api/list.php?shuffle&first=" + filename() + fileext(), function(json) {
    video_obj = json;
    vNum = 1;
  });
  $.ajaxSetup({async: true});

  tooltip();
  document.getElementById("bgvid").removeAttribute("hidden");
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
  document.getElementById("bgvid").play();
  document.getElementById("pause-button").classList.remove("fa-play");
  document.getElementById("pause-button").classList.add("fa-pause");

  ++vNum;
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

  document.getElementsByTagName("source")[0].src = "video/" + video.file;
  document.getElementsByTagName("source")[0].type = "video/" + videoMIMEsubtype(video.file);
  document.getElementById("bgvid").load();
  document.getElementById("subtitle-attribution").innerHTML = (video.subtitles ? "[" + video.subtitles + "]" : "");
  document.title = video.title + " from " + video.source;
  document.getElementById("title").innerHTML = video.title;
  document.getElementById("source").innerHTML = "Editor: " + video.source;
  document.getElementById("videolink").parentNode.removeAttribute("hidden");
  document.getElementById("videodownload").parentNode.removeAttribute("hidden");
  document.getElementById("videolink").href = "/?video=" + video.file.replace(/\.\w+$/, "");
  document.getElementById("videodownload").href = "video/" + video.file;


  var song = "";
  song = "Song: &quot;" + video.song.title + "&quot; by " + video.song.artist;
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
function playPause() {
  const video = document.getElementById("bgvid");
  if (video.paused) video.play();
  else video.pause();

  // Toggle Tooltip
  tooltip();
  tooltip("pause-button");

  // Toggle Play/Pause Icon
  $("#pause-button").toggleClass("fa-play").toggleClass("fa-pause");
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
  if (autonext || document.title == "Secret~") retrieveNewVideo();
  else document.getElementById("bgvid").play(); // loop
}

// Overused tooltip code
function tooltip(text, css) {
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
  const HS = history.state;
  return Boolean((HS.video[0] && HS.video[0].subtitles) || (HS.list[HS.video] && HS.list[HS.video].subtitles));
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
