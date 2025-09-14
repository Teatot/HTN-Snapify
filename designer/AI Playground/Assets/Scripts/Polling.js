// Scripts/Poller.js
// @input Asset.InternetModule net
// @input string baseUrl = ""     
// @input float intervalSeconds = 3.0                  // Poll cadence
// @input bool logVerbose = true
// @input Asset.ObjectPrefab[] prefabs

var isOn = false;
var nextPollEvt = null;
var backoff = 0;              // 0 = normal; >0 means we're backing off after an error
var maxBackoffSeconds = 30;

const dictionary_reference = {
    // shopify id: [ptr, sizeFactor]
    "7242646618181": [0, 1], // cozy_cabinet
    "7198596628549": [1, 1], // cozy_sofa
    "7221918859333": [2, 1], // cozy_table
    "14612445102452": [3, 1], // gothic_chair
    "7407366602827": [4, 1], // gothic_lamp
    "7330042019915": [5, 1], // gothic_table
    "7272726954059": [6, 1], // modern_chair
    "6839446765643": [7, 1], // modern_lamp
    "4668497166411": [8, 1] // modern_table

}; 



function spawnItem( curPrefrab, parentObject, xRow, yCol, sizeFactor ) {

    var parent = script.parent ? parentObject : script.getSceneObject();
    var instance = curPrefrab.instantiate(parent);

    // Print once per item
    print("Spawned prefab: " + instance.name);

    const normalize = (value) => {
            return ( value - 3) * 250; 
    };


    // Set position (replace with your desired coordinates)
    var pos = new vec3(normalize(xRow),  0, normalize(yCol),); // X, Y, Z
    instance.getTransform().setLocalPosition(pos);
}


function log() {
    if (script.logVerbose) {
        print.apply(this, arguments);
    }
}

function scheduleNextPoll(seconds) {
    if (!isOn) { return; }
    // Create (or reuse) a DelayedCallbackEvent
    if (!nextPollEvt) {
        nextPollEvt = script.createEvent("DelayedCallbackEvent");
        nextPollEvt.bind(function () {
            nextPollEvt = null;
            doPoll();
        });
    }
    nextPollEvt.reset(seconds);
}

function doPoll() {

    let curObject; 
    let fp; 
    let sizeFactor; 


    if (!isOn) { return; }

    var req = RemoteServiceHttpRequest.create();
    // Example endpoint – update to whatever you need
    req.url = script.baseUrl + "/api/get-grid";
    req.method = RemoteServiceHttpRequest.HttpRequestMethod.Get;


    script.net.performHttpRequest(req, function (res) {
        if (res.statusCode === 200) {
            // SUCCESS
            backoff = 0; // reset backoff


            
            const data = JSON.parse(res.body)["grid"]; 

            print(data); 
            for ( let i = 0; i < data.length; i++ ) {

                print(data[i]); 

                curObject = dictionary_reference[data[i][0]]; 

                if ( curObject == null ) {

                    print("DNE"); 
                    break; 
                }
                fp = curObject[0]; 
                sizeFactor = curObject[1]; 

                spawnItem( script.prefabs[i], script.parent, data[i][1], data[i][2] );
            }

            scheduleNextPoll(script.intervalSeconds);
        } else {
            // ERROR – exponential backoff
            backoff = Math.min((backoff === 0 ? 2 : backoff * 2), maxBackoffSeconds);
            log("Poll error", res.statusCode, "retrying in", backoff, "s. Body:", res.body);
            scheduleNextPoll(backoff);
        }
    });
}

// Start when the object turns on
script.createEvent("TurnOnEvent").bind(function () {
    isOn = true;
    scheduleNextPoll(0.01); // kick immediately
});

// Stop when the object turns off (prevents background requests)
script.createEvent("TurnOffEvent").bind(function () {
    isOn = false;
    nextPollEvt = null;
});
