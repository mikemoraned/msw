(function (doc, nav) {
    "use strict";

    var video, width, height,
        zeroResponseContext,
        logOpponentBuffers = {}, logOpponentContexts = {},
        skinBuffer, skinContext;
    var bufidx = 0, buffers = [];

    function initialize() {
        // The source video.
        video = doc.getElementById("v");
        width = video.width;
        height = video.height;

        // zero response
        var zeroResponseCanvas = doc.getElementById("zero-response-adjusted");
        zeroResponseContext = zeroResponseCanvas.getContext("2d");

        // log opponent
        logOpponentBuffers['i'] = new Int16Array(width * height);
        logOpponentBuffers['rg'] = new Int16Array(width * height);
        logOpponentBuffers['by'] = new Int16Array(width * height);

        logOpponentContexts['i'] = doc.getElementById("log-opponent-i").getContext("2d");
        logOpponentContexts['rg'] = doc.getElementById("log-opponent-rg").getContext("2d");
        logOpponentContexts['by'] = doc.getElementById("log-opponent-by").getContext("2d");

        // candidate skin pixels
        skinBuffer = new Uint8Array(width * height);
        skinContext = doc.getElementById("skin").getContext("2d");

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
            convertToLogOpponent(frame.data, logOpponentBuffers);
            visualiseLogOpponent(logOpponentBuffers, logOpponentContexts);
            detectSkin(logOpponentBuffers, skinBuffer);
            visualiseSkin(skinBuffer, skinContext);
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

    function convertToLogOpponent(data, logOpponentBuffers) {
        function logBase10(x) {
            return Math.log(x) / Math.log(10);
        }
        function noise() {
            return Math.random();
        }
        function L(x) {
            return 105*logBase10(x+1+noise());
        }

        for (var i = 0; i < data.length; i+= 4) {
            var index = i / 4;
            var r = data[i];
            var g = data[i+1];
            var b = data[i+2];
            logOpponentBuffers['i'][index] = L(g);
            logOpponentBuffers['rg'][index] = L(r) - L(g);
            logOpponentBuffers['by'][index] = L(b) - (L(g) + L(r))/2;
        }
    }

    function visualiseLogOpponent(logOpponentBuffers, logOpponentContexts)
    {
        function findBounds(buffer) {
            var min = buffer[0];
            var max = buffer[0];
            for (var i = 0; i < buffer.length; i++) {
                var value = buffer[i];
                min = Math.min(value, min);
                max = Math.max(value, max);
            };
            var range = max - min;
            return {
                max: max,
                min: min,
                range: range
            };
        }
        function visualiseRange(buffer, context) {
            var bounds = findBounds(buffer);
            var image = context.createImageData(width, height);
            var data = image.data;
            for (var i = 0; i < data.length; i+= 4) {
                var value = buffer[i / 4];
                var scaled = 256 * ((value - bounds.min) / (bounds.range * 1.0));
                data[i] = data[i + 1] = data[i + 2] = scaled;
                data[i + 3] = 255;
            }
            context.putImageData(image, 0, 0);
//            context.fillRect(10, 10, width - 20, height - 20);
        }

        var parts = ['i','rg','by'];
        parts.forEach(function(part) {
            var context = logOpponentContexts[part];
            visualiseRange(logOpponentBuffers[part], context);
        });
    }

    function hue(i, logOpponentBuffers) {
        var rg = logOpponentBuffers['rg'][i];
        var by = logOpponentBuffers['by'][i];
        return Math.atan2(rg, by);
    }
    function saturation (i, logOpponentBuffers) {
        var rg = logOpponentBuffers['rg'][i];
        var by = logOpponentBuffers['by'][i];
        return Math.sqrt(Math.pow(rg, 2.0) + Math.pow(by, 2.0));
    }
    function between(value, lower, upper) {
        return (value >= lower) && (value <= upper);
    }

    function detectSkin(logOpponentBuffers, skinBuffer) {
        function skin(i, logOpponentBuffers) {
//            if (logOpponentBuffers['i'][i] <= 5) {
                var h = hue(i, logOpponentBuffers);
                var s = saturation(i, logOpponentBuffers);
//                return (between(h, 110, 150) && between(s, 20, 60))
//                    || (between(h, 130, 170) && between(s, 30, 130));
//            return between(s, 20, 60)
//                || between(s, 30, 130);
            return (between(s, 20, 60))
                || (between(s, 30, 130));
//            }
//            else {
//                return false;
//            }
        }

        for (var i = 0; i < logOpponentBuffers['i'].length; i++) {
            if (skin(i, logOpponentBuffers)) {
                skinBuffer[i] = 255;
            }
            else {
                skinBuffer[i] = 0;
            }
        }
    }

    function visualiseSkin(skinBuffer, skinContext) {
        var image = skinContext.createImageData(width, height);
        var data = image.data;
        for (var i = 0; i < data.length; i+= 4) {
            var value = skinBuffer[i / 4];
            data[i] = data[i + 1] = data[i + 2] = value;
            data[i + 3] = 255;
        }
        skinContext.putImageData(image, 0, 0);
    }

    addEventListener("DOMContentLoaded", initialize);
})(document, navigator);
