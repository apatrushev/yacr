var rouletteWS = null;
var pc = null;
var offer = null;
var localstream = null;
var sdpConstraints = {
	'mandatory': {
		'OfferToReceiveAudio':true,
		'OfferToReceiveVideo':true
}};
var pc_config = {"iceServers": [{"url": "stun:23.21.150.121"}]};
var pc_constraints = {"optional": [{"DtlsSrtpKeyAgreement": true}]};

function message(text) {
	$("#message").html(text);
}

function roulette() {
	if (!getUserMedia) {
		message("getUserMedia not supported by your browser");
		return;
	}
	var constraints = {"audio": false, "video": true};
    getUserMedia(constraints, localStreamConnected,
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
	localstream = stream;
	audioTracks = localstream.getAudioTracks();
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
	rouletteWS.onopen = null;
	rouletteWS.onclose = webSocketClosed;
	rouletteWS.onmessage = webSocketMessage;
	try {
		pc = new RTCPeerConnection(pc_config, pc_constraints);
		pc.onicecandidate = onIceCandidate;
		pc.onaddstream = onRemoteStreamAdded;
		//pc.onremovestream = onRemoteStreamRemoved;

		pc.addStream(localstream);
		var constraints = {"optional": [], "mandatory": {"MozDontOfferDataChannel": true}};
		// temporary measure to remove Moz* constraints in Chrome
		if (webrtcDetectedBrowser === "chrome") {
			for (var prop in constraints.mandatory) {
				if (prop.indexOf("Moz") != -1) {
					delete constraints.mandatory[prop];
				}
			}
		}
		constraints = mergeConstraints(constraints, sdpConstraints);
		pc.createOffer(onOfferCreated, null, constraints);
	} catch (e) {
		msg = "Failed to create PeerConnection";
		if (webrtcDetectedBrowser == "firefox") {
			msg += ': go to about:config and set media.peerconnection.enabled to true';
		}
		message(msg);
	}
}

function mergeConstraints(cons1, cons2) {
  var merged = cons1;
  for (var name in cons2.mandatory) {
    merged.mandatory[name] = cons2.mandatory[name];
  }
  merged.optional.concat(cons2.optional);
  return merged;
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
	attachMediaStream($("#video")[0], event.stream);
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
	}
}

function webSocketError() {
	message("WebSocket connection failed");
}
