const audioUtils = require('./audioUtils');  // for encoding audio data as PCM
const crypto = require('crypto'); // tot sign our pre-signed URL
const v4 = require('./aws-signature-v4'); // to generate our pre-signed URL
const marshaller = require("@aws-sdk/eventstream-marshaller"); // for converting binary event stream messages to and from JSON
const util_utf8_node = require("@aws-sdk/util-utf8-node"); // utilities for encoding and decoding UTF8
const mic = require('microphone-stream'); // collect microphone input as a stream of raw bytes
import {sendSearchQuery} from "../a3_frontend";

// our converter between binary event streams messages and JSON
const eventStreamMarshaller = new marshaller.EventStreamMarshaller(util_utf8_node.toUtf8, util_utf8_node.fromUtf8);

// our global variables for managing state
let languageCode;
let region;
let sampleRate;
let inputSampleRate;
let transcription = "";
let socket;
let micStream;
let socketError = false;
let transcribeException = false;

// check to see if the browser allows mic access
if (!window.navigator.mediaDevices.getUserMedia) {
    // Use our helper method to show an error on the page
    showError('We support the latest versions of Chrome, Firefox, Safari, and Edge. Update your browser and try your request again.');

    // maintain enabled/distabled state for the start and stop buttons
    toggleStartStop();
}

const searchSpeech = document.getElementById('submit_speech_query');
const stopBtn = document.getElementById('stop_button');
const submitBtn = document.getElementById('submit_query');

if (submitBtn){
    submitBtn.addEventListener('click', e => {
        e.preventDefault();
        console.log('in submitBtn');
        const search_query = document.getElementById('search_query').value;
        sendSearchQuery(search_query);
})}

if (searchSpeech) {
    searchSpeech.addEventListener('click', e => {
        e.preventDefault();
        toggleStartStop(true);
        console.log('in search_voice function');
        setLanguage();
        setRegion();
        window.navigator.mediaDevices.getUserMedia({
            video: false,
            audio: true
        }).then(data => {
            streamAudioToWebSocket(data);
        }).then(() => {
            transcription = '';
        }).catch(err => {
            showError('There was an error streaming your audio to Amazon Transcribe. Please try again.' + err);
            toggleStartStop();
        });
    });
}

let streamAudioToWebSocket = function (userMediaStream) {
    micStream = new mic();

    micStream.on("format", function (data) {
        inputSampleRate = data.sampleRate;
    });

    micStream.setStream(userMediaStream);

    let url = createPresignedUrl();

    console.log(`url in streamAudioToWebSocket: ${url}`);

    socket = new WebSocket(url);
    socket.binaryType = "arraybuffer";

    let sampleRate = 0;

    socket.onopen = function () {
        micStream.on('data', function (rawAudioChunk) {
                let binary = convertAudioToBinaryMessage(rawAudioChunk);
                if (socket.readyState === socket.OPEN)
                    socket.send(binary);
            }
        )
    };

    wireSocketEvents();
};

function setLanguage() {
    languageCode = "en-US";
    sampleRate = 44100;
}

function setRegion() {
    region = "us-east-1"
}

function wireSocketEvents() {
    socket.onmessage = function (message) {
        //convert the binary event stream message to JSON
        let messageWrapper = eventStreamMarshaller.unmarshall(Buffer(message.data));
        let messageBody = JSON.parse(String.fromCharCode.apply(String, messageWrapper.body));
        if (messageWrapper.headers[":message-type"].value === "event") {
            handleEventStreamMessage(messageBody);
        } else {
            transcribeException = true;
            showError(messageBody.Message);
            toggleStartStop();
        }
    };

    socket.onerror = function () {
        socketError = true;
        showError('WebSocket connection error. Try again.');
        toggleStartStop();
    };

    socket.onclose = function (closeEvent) {
        micStream.stop();

        // the close event immediately follows the error event; only handle one.
        if (!socketError && !transcribeException) {
            if (closeEvent.code !== 1000) {
                showError('</i><strong>Streaming Exception</strong><br>' + closeEvent.reason);
            }
            toggleStartStop();
        }
    };
}

let handleEventStreamMessage = function (messageJson) {
    let results = messageJson.Transcript.Results;

    const searchQuery = $('#search_query');

    if (results.length > 0) {
        if (results[0].Alternatives.length > 0) {
            let transcript = results[0].Alternatives[0].Transcript;

            transcript = decodeURIComponent(escape(transcript));

            searchQuery.val(transcription + transcript + "\n");

            // if this transcript segment is final, add it to the overall transcription
            if (!results[0].IsPartial) {
                //scroll the textarea down
                searchQuery.scrollTop(searchQuery[0].scrollHeight);
                transcription += transcript + "\n";
            }

            console.log(`text transcript: ${transcript}`);
            console.log(`text transcription: ${transcription}`);

            
        }
    }
};

let closeSocket = function () {
    if (socket.readyState === socket.OPEN) {
        micStream.stop();

        console.log('micStream.stop()');
        let emptyMessage = getAudioEventMessage(Buffer.from(new Buffer([])));
        let emptyBuffer = eventStreamMarshaller.marshall(emptyMessage);
        socket.send(emptyBuffer);
    }
};

if (stopBtn) {
    stopBtn.addEventListener('click', () => {
        console.log('in stop');
        closeSocket();
        toggleStartStop();
    });
}

function toggleStartStop(disableStart = false) {
    $('#submit_speech_query').prop('disabled', disableStart);
    $('#stop_button').attr("disabled", !disableStart);
}

function convertAudioToBinaryMessage(audioChunk) {
    let raw = mic.toRaw(audioChunk);

    if (raw == null)
        return;

    // downsample and convert the raw audio bytes to PCM
    let downsampledBuffer = audioUtils.downsampleBuffer(raw, inputSampleRate, sampleRate);
    let pcmEncodedBuffer = audioUtils.pcmEncode(downsampledBuffer);

    // add the right JSON headers and structure to the message
    let audioEventMessage = getAudioEventMessage(Buffer.from(pcmEncodedBuffer));

    //convert the JSON object + headers into a binary event stream message
    let binary = eventStreamMarshaller.marshall(audioEventMessage);

    return binary;
}

function getAudioEventMessage(buffer) {
    return {
        headers: {
            ':message-type': {
                type: 'string',
                value: 'event'
            },
            ':event-type': {
                type: 'string',
                value: 'AudioEvent'
            }
        },
        body: buffer
    };
}

function createPresignedUrl() {
    let endpoint = "transcribestreaming." + region + ".amazonaws.com:8443";

    return v4.createPresignedURL(
        'GET',
        endpoint,
        '/stream-transcription-websocket',
        'transcribe',
        crypto.createHash('sha256').update('', 'utf8').digest('hex'), {
            'key': "AKIA2LAEXSGLEP6OC6K2",
            'secret': "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",
            'sessionToken': "",
            'protocol': 'wss',
            'expires': 15,
            'region': region,
            'query': "language-code=" + languageCode + "&media-encoding=pcm&sample-rate=" + sampleRate
        }
    );
}

function showError(message) {
    $('#error').html('<i class="fa fa-times-circle"></i> ' + message);
    $('#error').show();
}
