/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
const exphbs = require('express-handlebars');

const RESOURCE_API_PATH = '../resourceApi';

function configureExpressApp(app, router) {
    // Set handlebars view engine
    app.engine('.hbs', exphbs({extname: '.hbs'}));
    app.set('view engine', '.hbs');
    app.use(router);

    // Set homeAccountId in memory
    app.locals.homeAccountId = null;
}

function handleAuthorizationResponse(res, authResponse, templateParams, scenarioConfig) {
    // Get scenario specific resource API
    const resourceApi = require(RESOURCE_API_PATH)(scenarioConfig.resourceApi);
    const username = authResponse.account.username;
    // Call graph after successfully acquiring token
    resourceApi.call(authResponse.accessToken, (authResponse, endpoint) => {
        // Successful silent request
        templateParams = {
            ...templateParams,
            username,
            profile: JSON.stringify(authResponse, null, 4)
        };
        res.render("authenticated", templateParams);
    });
}

module.exports = function(app, clientApplication, msalTokenCache, scenarioConfig)  {
    const router = require("express-promise-router")( );
    configureExpressApp(app, router);
    const requestConfig = scenarioConfig.request;
    /**
     * App Routes
     */
    router.get('/', (req, res) => {
        res.render("login", { showSignInButton: true});
    });
    
    // Initiates Auth Code Grant
    router.get('/login', (req, res) => {
        clientApplication.getAuthCodeUrl(requestConfig.authCodeUrlParameters)
            .then((response) => {
                res.redirect(response);
            })
            .catch((error) => console.log(JSON.stringify(error)));
    });

    // Attempt silent login
    router.get('/silentLogin', async (req, res) => {
        const accounts = await msalTokenCache.getAllAccounts();
        
        if (accounts.length > 0) {
            const account = accounts[0];
            app.locals.homeAccountId = account.homeAccountId;
            const silentRequest = { ...requestConfig.silentRequest, account: account };    
            let templateParams = { showLoginButton: false };
            // Acquire Token Silently to be used in MS Graph call
            clientApplication.acquireTokenSilent(silentRequest)
                .then((authResponse) => {
                    handleAuthorizationResponse(res, authResponse, templateParams, scenarioConfig);
                })
                .catch((error) => {
                    console.log(error);
                    templateParams.couldNotAcquireToken = true;
                    res.render("authenticated", templateParams)
                });
        } else {
            res.render("login", { failedSilentLogin: true, showSignInButton: true });
        }
    });
    
    // Second leg of Auth Code grant
    router.get('/redirect', (req, res) => {
        const tokenRequest = { ...requestConfig.tokenRequest, code: req.query.code };
        clientApplication.acquireTokenByCode(tokenRequest).then((response) => {
            app.locals.homeAccountId = response.account.homeAccountId;
            const templateParams = { showLoginButton: false, username: response.account.username, profile: false};
            res.render("authenticated", templateParams);
        }).catch((error) => {
            console.log(error);
            res.status(500).send(error);
        });
    });

    // Displays all cached accounts
    router.get('/allAccounts', async (req, res) => {
        const accounts = await msalTokenCache.getAllAccounts();

        if (accounts.length > 0) {
            res.render("authenticated", { accounts: JSON.stringify(accounts, null, 4) })
        } else if(accounts.length === 0) {
            res.render("authenticated", { accounts: JSON.stringify(accounts), noAccounts: true, showSignInButton: true });
        } else {
            res.render("authenticated", { failedToGetAccounts: true, showSignInButton: true })
        }
    });
    
    // Initiates Acquire Token Silent flow
    router.get('/graphCall', async (req, res) => {
        // get Accounts
        const account = await msalTokenCache.getAccountByHomeId(app.locals.homeAccountId);
        /** 
         * Account index must match the account's position in the cache. The sample cache file contains a dummy account
         * entry in index 0, hence the actual account that is logged in will be index 1
         */
        const silentRequest = { ...requestConfig.silentRequest, account: account };
    
        let templateParams = { showLoginButton: false };
        // Acquire Token Silently to be used in MS Graph call
        clientApplication.acquireTokenSilent(silentRequest)
            .then((authResponse) => {
                handleAuthorizationResponse(res, authResponse, templateParams, scenarioConfig);
            })
            .catch((error) => {
                console.log(error);
                templateParams.couldNotAcquireToken = true;
                res.render("authenticated", templateParams)
            });
    });
};
