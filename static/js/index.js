/*
 * (C) Copyright 2014-2015 Kurento (http://kurento.org/)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

var client = Charpy.Client;
var room = client.createRoom();

room.join();

window.onload = function() {
	console = new Console();

	document.getElementById('call').addEventListener('click', function() {
		room.present();
	});
	document.getElementById('viewer').addEventListener('click', function() {
		room.spectate();
	});
	document.getElementById('terminate').addEventListener('click', function() {
		room.leave();
	});
}

window.onbeforeunload = function() {
	room.leave();
}

/**
 * Lightbox utility (to display media pipeline image in a modal dialog)
 */
$(document).delegate('*[data-toggle="lightbox"]', 'click', function(event) {
	event.preventDefault();
	$(this).ekkoLightbox();
});
