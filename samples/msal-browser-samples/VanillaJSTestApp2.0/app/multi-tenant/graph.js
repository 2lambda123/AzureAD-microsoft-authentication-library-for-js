// Helper function to call MS Graph API endpoint 
// using authorization bearer token scheme
function callMSGraph(endpoint, accessToken, callback) {
    const headers = new Headers();
    const bearer = `Bearer ${accessToken}`;

    headers.append("Authorization", bearer);

    const options = {
        method: "GET",
        headers: headers
    };

    console.log('request made to Graph API at: ' + new Date().toString());

    fetch(endpoint, options)
        .then(response => response.json())
        .then(response => callback(response, endpoint))
        .catch(error => console.log(error));
}

async function seeProfile() {
    const currentAcc = myMSALObj.getActiveAccount();
    if (currentAcc) {
        const request = {...loginRequest, authority: `${baseAuthority}/${currentAcc.tenantId}`};
        const response = await getTokenRedirect(request, currentAcc).catch(error => {
            console.log(error);
        });
        console.log(response);
        callMSGraph(graphConfig.graphMeEndpoint, response.accessToken, updateUI);
    }
}