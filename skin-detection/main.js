(function (doc, nav) {
    "use strict";

    var video, width, height, zeroResponseContext, logOpponentContexts = {};
    var bufidx = 0, buffers = [];

    function initialize() {
        // The source video.
        video = doc.getElementById("v");
        width = video.width;
        height = video.height;

        // The target canvases.
        var zeroResponseCanvas = doc.getElementById("zero-response-adjusted");
        zeroResponseContext = zeroResponseCanvas.getContext("2d");

        logOpponentContexts['i'] = doc.getElementById("log-opponent-i").getContext("2d");
        logOpponentContexts['rg'] = doc.getElementById("log-opponent-rg").getContext("2d");
        logOpponentContexts['by'] = doc.getElementById("log-opponent-by").getContext("2d");

        // Get the webcam's stream.
        nav.getUserMedia({video: true}, startStream, function () {});
    }

    function startStream(stream) {
        video.src = URL.createObjectURL(stream);
        video.play();

        // Ready! Let's start drawing.
        requestAnimationFrame(draw);
    }

    function draw() {
        var frame = readFrame();

        if (frame) {
          zeroResponseAdjust(frame.data);
          zeroResponseContext.putImageData(frame, 0, 0);
        }

        // Wait for the next frame.
        requestAnimationFrame(draw);
    }

    function readFrame() {
        try {
          zeroResponseContext.drawImage(video, 0, 0, width, height);
        } catch (e) {
          // The video may not be ready, yet.
          return null;
        }

        return zeroResponseContext.getImageData(0, 0, width, height);
    }

    function findRGBMinimums(data) {
        var minimums = [ data[0], data[1], data[2] ];
        for (var i = 0; i < data.length; i+= 4) {
            for (var j = 0; j < minimums.length; j++) {
                minimums[j] = Math.min(minimums[j], data[i + j]);
            }
        }
        return minimums;
    }

    function removeOffsets(data, minimums) {
        for (var i = 0; i < data.length; i+= 4) {
            for (var j = 0; j < minimums.length; j++) {
                data[i + j] = data[i + j] - minimums[j];
            }
        }
    }

    function zeroResponseAdjust(data) {
        var minimums = findRGBMinimums(data);
        removeOffsets(data, minimums);
    }

  addEventListener("DOMContentLoaded", initialize);
})(document, navigator);
