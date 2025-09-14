// @input Asset.InternetModule net
// Scripts/FetchAPI.js
// @input Asset.InternetModule net

var req = RemoteServiceHttpRequest.create();
req.url = "https://07f089b8be61.ngrok-free.app/api/get-grid";
req.method = RemoteServiceHttpRequest.HttpRequestMethod.Get;

script.net.performHttpRequest(req, function (res) {
  if (res.statusCode === 200) {
    // Able to Fetch Data 

    //
  } else {
    // Unable to Fetch Error 
    print("HTTP error " + res.statusCode + " — body: " + res.body);
  }
});

