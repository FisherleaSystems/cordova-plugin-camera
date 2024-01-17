/*
 *
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 *
 */

const HIGHEST_POSSIBLE_Z_INDEX = 2147483647;

function takePicture (success, error, opts) {
    var quality = opts[0];
    var targetWidth = opts[3];
    var targetHeight = opts[4];
    var encodingType = opts[5];

    if (opts && opts[2] === 1) {
        capture(success, error, opts);
    } else {
        const input = document.createElement('input');
        input.accept = 'image/*';
        input.style.position = 'absolute';
        input.style.top = '-50px';
        input.style.visibility = 'hidden';
        input.className = 'cordova-camera-select';
        input.type = 'file';

        input.onchange = function (inputEvent) {
            const reader = new FileReader(); /* eslint no-undef : 0 */
            reader.onload = function (readerEvent) {
                var convert = false;
                var data = readerEvent.target.result;

                // Strip off the start of the string.
                const t = data.slice(5, 20);
                // Split it
                const a = t.split(';');
                // Compare with the desired encoding type.
                if (a[0] !== encodingType) {
                    // Different encoding type, so force a conversion.
                    convert = true;
                }

                // Adjust the image size if needed.
                if (convert || (targetWidth && targetHeight)) {
                    var img = document.createElement('img');
                    img.onerror = error;
                    img.onload = function (event) {
                        var canvas, ctx, h, ratio, w;

                        w = img.width;
                        h = img.height;

                        if (!h || !w) {
                            error('Unable to determine image size.');
                            return;
                        }

                        ratio = w / h;
                        if (w > targetWidth) {
                            w = targetWidth;
                            h = w / ratio;
                        }

                        if (h > targetHeight) {
                            h = targetHeight;
                            w = h * ratio;
                        }

                        // Convert based on format or if the target is smaller than the source image.
                        if (convert || w < img.width || h < img.height) {
                            canvas = document.createElement('canvas');
                            canvas.width = w;
                            canvas.height = h;

                            ctx = canvas.getContext('2d');
                            ctx.drawImage(img, 0, 0, w, h);

                            // Always return a data URL...
                            data = canvas.toDataURL(encodingType, quality / 100);
                        }

                        success(data);
                    };

                    img.setAttribute('src', data);
                } else {
                    success(data);
                }
            };

            if (inputEvent.target.files.length) {
                reader.readAsDataURL(inputEvent.target.files[0]);
            } else {
                error('No file selected by user.');
            }

            // Remove the input from the DOM.
            input.parentNode.removeChild(input);
        };

        document.body.appendChild(input);

        var event;

        if (typeof MouseEvent === 'function') {
            event = new MouseEvent('click', {
                view: window,
                bubbles: true,
                cancelable: true
            });
        } else {
            event = document.createEvent('UIEvents');
            event.initUIEvent('click', true, true, window, 1);
        }

        input.dispatchEvent(event);
    }
}

function capture (success, errorCallback, opts) {
    let localMediaStream;
    const quality = opts[0];
    let targetWidth = opts[3];
    let targetHeight = opts[4];
    const encodingType = opts[5];

    targetWidth = targetWidth === -1 ? 320 : targetWidth;
    targetHeight = targetHeight === -1 ? 240 : targetHeight;

    const video = document.createElement('video');
    const buttonCancel = document.createElement('button');
    const buttonCapture = document.createElement('button');
    const parent = document.createElement('div');

    parent.style.position = 'relative';
    parent.style.zIndex = HIGHEST_POSSIBLE_Z_INDEX;
    parent.className = 'cordova-camera-capture';
    parent.appendChild(video);
    parent.appendChild(buttonCancel);
    parent.appendChild(buttonCapture);

    video.width = targetWidth;
    video.height = targetHeight;
    buttonCancel.innerHTML = 'Cancel';
    buttonCapture.innerHTML = 'Capture';

    buttonCancel.onclick = function () {
        // stop video stream, remove video and buttons.
        // Note that MediaStream.stop() is deprecated as of Chrome 47.
        if (localMediaStream.stop) {
            localMediaStream.stop();
        } else {
            localMediaStream.getTracks().forEach(function (track) {
                track.stop();
            });
        }
        parent.parentNode.removeChild(parent);

        return errorCallback('User did not take a picture.');
    };

    buttonCapture.onclick = function () {
        // create a canvas and capture a frame from video stream
        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        canvas.getContext('2d').drawImage(video, 0, 0, targetWidth, targetHeight);

        // convert image stored in canvas to base64 encoded image
        var imageData = canvas.toDataURL(encodingType, quality / 100);

        // stop video stream, remove video and buttons.
        // Note that MediaStream.stop() is deprecated as of Chrome 47.
        if (localMediaStream.stop) {
            localMediaStream.stop();
        } else {
            localMediaStream.getTracks().forEach(function (track) {
                track.stop();
            });
        }
        parent.parentNode.removeChild(parent);

        return success(imageData);
    };

    navigator.getUserMedia = navigator.getUserMedia ||
                             navigator.webkitGetUserMedia ||
                             navigator.mozGetUserMedia ||
                             navigator.msGetUserMedia;

    const successCallback = function (stream) {
        localMediaStream = stream;

        var videoTracks = stream.getVideoTracks();
        var track = videoTracks[0];
        var settings = track.getSettings();

        // Update the target sizes to match the camera.
        targetWidth = settings.width;
        targetHeight = settings.height;

        video.width = targetWidth;
        video.height = targetHeight;

        if ('srcObject' in video) {
            video.srcObject = stream;
        } else {
            video.src = window.URL.createObjectURL(stream);
        }

        document.body.appendChild(parent);
        video.play();
    };

    if (navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ video: { width: targetWidth, height: targetHeight }, audio: false })
            .then(successCallback)
            .catch(errorCallback);
    } else if (navigator.getUserMedia) {
        navigator.getUserMedia({ video: { width: targetWidth, height: targetHeight }, audio: false }, successCallback, errorCallback);
    } else {
        alert('Browser does not support camera :(');
    }
}

module.exports = {
    takePicture,
    cleanup: function () {}
};

require('cordova/exec/proxy').add('Camera', module.exports);
