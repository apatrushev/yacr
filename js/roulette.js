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

function localStreamConnected(stream) {
	attachMediaStream($("#local_video")[0], stream);
}
