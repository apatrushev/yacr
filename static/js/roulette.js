function wsURI(rel) {
	var loc = window.location;
	var new_uri = loc.protocol.replace(/^http/, "ws") + "//";
	new_uri += loc.host;
	new_uri += loc.pathname;
	if (loc.pathname[loc.pathname.length - 1] != "/") {
		new_uri += "/";
	}
	new_uri += rel;
	return new_uri;
}

roulette = function($, undefined) {
    var self = this;
    var sdpConstraints = {
        'mandatory': {
            'OfferToReceiveAudio':true,
            'OfferToReceiveVideo':true
    }};
    var pc_config = { "iceServers": [{ "url": "stun:23.21.150.121" }]};
    var pc_constraints = { "optional": [{ "DtlsSrtpKeyAgreement": true }]};

    self.local_stream = undefined;
    self.roulette_ws = undefined;
    self.peer_connection = undefined;
    self.offer = undefined;

    self.add_message = function(text) {
        $("#message").html(text);
    }

    self.open_socket = function() {
        self.roulette_ws = new WebSocket(wsURI("roulette"));
        self.roulette_ws.onopen = self.on_websocket_open;
        self.roulette_ws.onclose = self.on_websocket_error;
    }

    self.build_peer_connection = function() {
        var pc = new RTCPeerConnection(pc_config, pc_constraints);
        pc.onicecandidate = self.on_ice_candidate;
        pc.onaddstream = self.on_remotestream_added;
        pc.addStream(self.local_stream);
        return pc;
    }

    self.on_document_ready = function() {
        if (!getUserMedia) {
            message("getUserMedia not supported by your browser");
            return;
        }

        getUserMedia(
            { "audio": true, "video": false },
            self.on_localstream_connected,
            self.on_localstream_error
       );
    }

    self.on_localstream_connected = function(stream) {
        self.add_message("local stream connected");
        self.local_stream = stream;
        if (!window.WebSocket) {
            self.add_message("WebSocket's not supported by your browser");
            return;
        }
        attachMediaStream($("#localVideo")[0], stream);
        self.open_socket();
    }

    self.on_localstream_error = function() {
        self.add_message("error accessing video capture device");
    }

    self.on_websocket_open = function() {
        self.add_message("WebSocket connected");
        self.roulette_ws.onopen = null;
        self.roulette_ws.onclose = self.on_websocket_closed;
        self.roulette_ws.onmessage = self.on_websocket_message;
        try {
            self.peer_connection = self.build_peer_connection();
            self.peer_connection.createOffer(self.on_offer_created, self.on_offer_failed, sdpConstraints);
        } catch (e) {
            self.add_message("Failed to create PeerConnection" + e);
        }
    }

    self.on_websocket_message = function(evt) {
        var msg = JSON.parse(evt.data);
        if (msg.type == "offer") {
            self.add_message("Offer received");
            self.peer_connection = self.build_peer_connection();
            self.peer_connection.setRemoteDescription(new RTCSessionDescription(msg));
            self.peer_connection.createAnswer(self.on_answer_created, self.on_answer_failed, sdpConstraints);
            self.offer = undefined;
        } else if (msg.type == "answer") {
            self.add_message("Answer received");
            self.peer_connection.setLocalDescription(offer);
            self.peer_connection.setRemoteDescription(new RTCSessionDescription(msg));
        } else if (msg.type === 'candidate') {
            var candidate = new RTCIceCandidate({sdpMLineIndex: msg.label, candidate: msg.candidate});
            self.peer_connection.addIceCandidate(candidate);
        }
    }

    self.on_websocket_error = function() {
        self.add_message("WebSocket connection failed");
        setTimeout(self.open_socket, 1000);
    }

    self.on_offer_created = function(sd) {
        if (!self.peer_connection) return;
        self.add_message("Offer created" + sd);
        self.roulette_ws.send(JSON.stringify(sd));
        self.offer = sd;
    }

    self.on_offer_failed = function(error) {
        self.add_message("createOffer failed" + error);
    }

    self.on_answer_created = function(sd) {
        if (!self.peer_connection) return;
        self.add_message("Answer created");
        self.peer_connection.setLocalDescription(sd);
        self.roulette_ws.send(JSON.stringify(sd));
    }

    self.on_answer_failed = function(error) {
        self.add_message("createAnswer failed" + error);
    }

    self.on_remotestream_added = function(evt) {
        self.add_message("Remote stream added");
        attachMediaStream($("#remoteVideo")[0], evt.stream);
    }

    self.on_ice_candidate = function(evt) {
        if (evt.candidate) {
            self.roulette_ws.send(JSON.stringify({
                type: 'candidate',
                label: evt.candidate.sdpMLineIndex,
                id: evt.candidate.sdpMid,
                candidate: evt.candidate.candidate
            }));
        }
    }

    $(document).ready(self.on_document_ready);
}($);
