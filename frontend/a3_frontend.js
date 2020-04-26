console.log('in a3_frontend.js');
window.onload = function () {
    document.getElementById('submit_query').onclick = search;
    document.getElementById('upload_photo').onclick = upload;
    // document.getElementById('submit_speech_query').onclick = search_via_speech;
};

function upload(e) {
    e.preventDefault();
    console.log('in upload function');
    var fileInput = document.getElementById("myFile");
    console.log(fileInput)
    var file = fileInput.files[0];
    console.log(file)
    var filename = file.name;
    var extension = file.type;
    console.log(filename)
    console.log(extension)
    let config = {
        headers: {'Content-Type': 'multipart/form-data', "X-Api-Key": "thisisatestkey1234567890"}
    };  //添加请求头
    url = 'https://me8p5df1qc.execute-api.us-east-1.amazonaws.com/prod/upload/ccc-assignment3-b2/' + file.name

    $.ajax({
        url: url,
        type: 'PUT',
        data: file,
        dataType: 'html',
        headers: {"X-API-Key": "thisisatestkey1234567890"},
        processData: false,
        contentType: extension,
        success: function (response) {
            alert("Successful");
        },
        error: function (xhr, status, error) {
            errMsg = "Failed.<br>" + xhr.responseText + "<br>" + status + "<br>" + error;
            alert("errMsg");
        }
    });
}


function search(e) {
    e.preventDefault();
    console.log('in search function');
    var query = document.getElementById('search_query').value;
    sendSearchQuery(query);
}

export const sendSearchQuery = function (query) {
    console.log(`query : ${query}`);

    var apigClient = apigClientFactory.newClient({
        apiKey: 'thisisatestkey1234567890'
    });

    var params = {
        // This is where any modeled request parameters should be added.
        // The key is the parameter name, as it is defined in the API in API Gateway.
        "q": query
    };
    var body = {};

    var additionalParams = {
        // If there are any unmodeled query parameters or headers that must be
        //   sent with the request, add them here.
        headers: {},
        queryParams: {}
    };
    console.log('before searchGet');
    apigClient.searchGet(params, body, additionalParams)
        .then(function (result) {
            // Add success callback code here.
            console.log('success OK');
            console.log(result);
            displayImage(result.data.results.items, query);
        }).catch(function (result) {
        // Add error callback code here.
        console.log('no corresponding photos');
        console.log(result)
    });
};


function displayImage(images, query) {
    const container = document.getElementById("display");
    const image_display_text = document.getElementById('div_text');

    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }

    if (images == null || images.length === 0) {
        image_display_text.innerHTML = "No photo for " + query;
        return;
    } else {
        image_display_text.innerHTML = "Results for " + query;
    }

    const imageObj = JSON.parse(images);
    // console.log(imageObj.url);
    if (imageObj.url === "No such photos found.") {
        image_display_text.innerHTML = "No photo for " + query;
        return;
    } else {
        image_display_text.innerHTML = "Results for " + query;
    }

    imageObj.url.forEach(imgUrl => {
        try {
            const img = document.createElement("img");
            img.src = imgUrl;
            container.appendChild(img);
        } catch (err) {
            console.log(err);
            alert(err);
        }
    })
}

