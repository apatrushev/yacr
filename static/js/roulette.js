var rouletteWS = null;
var pc = null;
var offer = null;
var localstream = null;
var sdpConstraints = {
	'mandatory': {
		'OfferToReceiveAudio':false,
		'OfferToReceiveVideo':true
}};
var pc_config = {"iceServers": [{"url": "stun:23.21.150.121"}]};
var pc_constraints = {"optional": [{"DtlsSrtpKeyAgreement": true}]};

function message(text) {
	document.getElementById("message").innerHTML = text;
}

function roulette() {
	if (!getUserMedia) {
		message("getUserMedia not supported by your browser");
		return;
	}
	var constraints = { "audio": false, "video": true };
    getUserMedia(constraints, localStreamConnected,
        function() {
          message("error accessing video capture device");
        }
    );
}

function wsURI(rel) {
	var loc = window.location, new_uri;
	new_uri = loc.protocol.replace(/^http/, "ws") + "//";
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
	localstream = stream;
	if (!window.WebSocket) {
		message("WebSocket's not supported by your browser");
		return;
	}
	attachMediaStream(document.getElementById("localVideo"), stream);
	openSocket();
}

function openSocket() {
    rouletteWS = new WebSocket(wsURI("roulette"));
    rouletteWS.onopen = webSocketConnected;
    rouletteWS.onclose = webSocketError;
}

function webSocketConnected() {
	message("WebSocket connected");
	rouletteWS.onopen = null;
	rouletteWS.onclose = webSocketClosed;
	rouletteWS.onmessage = webSocketMessage;
	try {
		pc = new RTCPeerConnection(pc_config, pc_constraints);
		pc.onicecandidate = onIceCandidate;
		pc.onaddstream = onRemoteStreamAdded;
		//pc.onremovestream = onRemoteStreamRemoved;

		pc.addStream(localstream);
		var constraints = JSON.parse(JSON.stringify(sdpConstraints));
		// temporary measure to remove Moz* constraints in Chrome
		if (webrtcDetectedBrowser === "firefox") {
			constraints.mandatory["MozDontOfferDataChannel"] = true;
		}
		pc.createOffer(onOfferCreated, null, constraints);
	} catch (e) {
		msg = "Failed to create PeerConnection";
		if (webrtcDetectedBrowser == "firefox") {
			msg += ': go to about:config and set media.peerconnection.enabled to true';
		}
		message(msg);
	}
}

function onOfferCreated(sd) {
	if (!pc) return;
	message("Offer created");
	offer = sd;
	rouletteWS.send(JSON.stringify(sd));
}

function onIceCandidate(evt) {
	if (event.candidate) {
		rouletteWS.send(JSON.stringify({
			type: 'candidate',
			label: event.candidate.sdpMLineIndex,
			id: event.candidate.sdpMid,
			candidate: event.candidate.candidate
		}));
	}
}

function onRemoteStreamAdded(event) {
	message("Remote stream added");
	attachMediaStream(document.getElementById("remoteVideo"), event.stream);
}

function webSocketMessage(evt) {
	var msg = JSON.parse(evt.data);
	if (msg.type == "offer") {
		message("Offer received");
		pc = new RTCPeerConnection(pc_config, pc_constraints);
		pc.onicecandidate = onIceCandidate;
		pc.onaddstream = onRemoteStreamAdded;
		pc.addStream(localstream);
		pc.setRemoteDescription(new RTCSessionDescription(msg));
		pc.createAnswer(onAnswerCreated, null, sdpConstraints);
	} else if (msg.type == "answer") {
		message("Answer received");
		pc.setLocalDescription(offer);
		pc.setRemoteDescription(new RTCSessionDescription(msg));
	} else if (msg.type === 'candidate') {
		var can = new RTCIceCandidate({sdpMLineIndex:msg.label, candidate:msg.candidate});
		pc.addIceCandidate(can);
	}
}

function onAnswerCreated(sd) {
	if (!pc) return;
	message("Answer created");
	pc.setLocalDescription(sd);
	rouletteWS.send(JSON.stringify(sd));
}

function webSocketClosed() {
	message("WebSocket closed");
	if (pc) {
		pc.close();
		pc = null;
		rouletteWS = null;
	}
	openSocket();
}

function webSocketError() {
	message("WebSocket connection failed");
	setTimeout(openSocket, 1000);
}
