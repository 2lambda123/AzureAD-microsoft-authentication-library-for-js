import fs from "fs";
import { Deserializer, Serializer } from "../../lib/msal-node";
import { InMemoryCache } from '../../lib/msal-node/dist/cache/serializer/SerializerTypes';

export type tokenMap = {
    idTokens: string[],
    accessTokens: any[],
    refreshTokens: string[]
};

export class NodeCacheTestUtils {
    static getTokens(cacheLocation: string): tokenMap {
        const cache = (fs.existsSync(cacheLocation)) ?  fs.readFileSync(cacheLocation, { encoding: 'utf-8' }) : "{}";
        const deserializedCache = Deserializer.deserializeAllCache(JSON.parse(cache));

        const tokenCache: tokenMap = {
            idTokens: [],
            accessTokens: [],
            refreshTokens: []
        };

        Object.keys(tokenCache).forEach((cacheSectionKey: string) => {
            Object.keys(deserializedCache[cacheSectionKey]).map((cacheKey) => {
                const cacheSection = deserializedCache[cacheSectionKey];
                tokenCache[cacheSectionKey].push({ 
                    key: cacheKey,
                    token: cacheSection[cacheKey]
                });
            })
        });

        return tokenCache;
    }

    static getAccessTokens(cacheLocation: string): Array<any> {
        const allTokens = NodeCacheTestUtils.getTokens(cacheLocation);
        return allTokens.accessTokens;
    }

    static getDeserializedCache(cacheLocation: string): InMemoryCache {
        const cache = (fs.existsSync(cacheLocation)) ?  fs.readFileSync(cacheLocation, { encoding: 'utf-8' }) : "{}";
        const deserializedCache = Deserializer.deserializeAllCache(JSON.parse(cache));
        return deserializedCache;
    }

    static expireAccessTokens(cacheLocation: string): void {
        const deserializedCache = NodeCacheTestUtils.getDeserializedCache(cacheLocation);
        const atKeys = Object.keys(deserializedCache.accessTokens);

        atKeys.forEach((atKey: string) => {
            deserializedCache.accessTokens[atKey].expiresOn = "0";
            deserializedCache.accessTokens[atKey].extendedExpiresOn = "0";
        });

        const serializedCache = Serializer.serializeAllCache(deserializedCache);
        try {
            fs.writeFileSync(cacheLocation, JSON.stringify(serializedCache, null, 1));
        } catch (error) {
            console.error("Error writing to cache file in resetCache: ", error);
        }
    }

    static resetCache(cacheLocation: string): void {
        const jsonCache = (fs.existsSync(cacheLocation)) ? require(cacheLocation) : this.getCacheTemplate();
        const cache: InMemoryCache = Deserializer.deserializeAllCache(jsonCache);
        Object.keys(cache).forEach( key => cache[key] = []);
        const serializedCache = Serializer.serializeAllCache(cache);

        try {
            fs.writeFileSync(cacheLocation, JSON.stringify(serializedCache, null, 1));
        } catch (error) {
            console.error("Error writing to cache file in resetCache: ", error);
        }
    }

    private static getCacheTemplate(): any {
        return JSON.stringify({
            Account: {},
            IdToken: {},
            AccessToken: {},
            RefreshToken: {},
            AppMetadata: {}
        });
    }
}
