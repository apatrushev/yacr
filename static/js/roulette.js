var rouletteWS = null;
var pc = null;

function message(text) {
	$("#message").text(text);
}

function roulette() {
	if (!getUserMedia) {
		message("getUserMedia not supported by your browser");
		return;
	};
    getUserMedia({video:true, audio:false}, localStreamConnected,
        function() {
          message("error accessing video capture device");
        }
    );
}

function wsURI(rel) {
	var loc = window.location, new_uri;
	if (loc.protocol === "https:") {
		new_uri = "wss://";
	} else {
		new_uri = "ws://";
	}
	new_uri += loc.host;
	new_uri += loc.pathname;
	if (loc.pathname[loc.pathname.length - 1] != "/") {
		new_uri += "/";
	}
	new_uri += rel;
	return new_uri;
}

function localStreamConnected(stream) {
	message("Local stream connected");
	attachMediaStream($("#local_video")[0], stream);
	if (!window.WebSocket) {
		message("WebSocket's not supported by your browser");
		return;
	}
    rouletteWS = new WebSocket(wsURI("roulette"));
    rouletteWS.onopen = webSocketConnected;
    rouletteWS.onclose = webSocketError;
}

function webSocketConnected() {
	message("WebSocket connected");
	rouletteWS.onclose = webSocketClosed;
	var pc_config = {"iceServers": [{"url": "stun:173.194.69.127:19302"}]};
	try {
		pc = new RTCPeerConnection(pc_config);
		pc.createOffer(onOffer)
	} catch (e) {
		msg = "Failed to create PeerConnection";
		if (webrtcDetectedBrowser == "firefox") {
			msg += ": go to about:config and set media.peerconnection.enabled to true";
		}
		message(msg);
	}
}

function onOffer(sd) {
	message("Offer created")
	pc.setLocalDescription(sd);
	rouletteWS.send(JSON.stringify(sd));
}

function webSocketClosed() {
	message("WebSocket closed");
}

function webSocketError() {
	message("WebSocket connection failed");
}
