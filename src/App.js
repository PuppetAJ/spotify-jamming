import React, { useEffect, useState } from "react";
import logo from "./logo.svg";
import "./App.css";

function App() {
  const [currentToken, setCurrentToken] = useState();

  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [callBack, setCallback] = useState(true);
  const [expiration, setExpiration] = useState("");
  const [expired, setExpired] = useState(false);

  const clientId = process.env.REACT_APP_CLIENT_ID;
  const redirectUrl = process.env.REACT_APP_REDIRECT_URL;

  const authorizationEndpoint = "https://accounts.spotify.com/authorize";
  const tokenEndpoint = "https://accounts.spotify.com/api/token";
  const scope = "user-read-private user-read-email";

  useEffect(() => {
    const testLocalToken = localStorage.getItem("access_token");
    if (testLocalToken && testExpiration()) {
      const data = {
        refresh_token: localStorage.getItem("refresh_token"),
        access_token: localStorage.getItem("access_token"),
        expires_in: localStorage.getItem("expires_in"),
        expires: localStorage.getItem("expires"),
        scope: scope,
        token_type: "Bearer",
      };

      setCurrentToken(data);
    }
  }, []);

  useEffect(() => {
    async function testSpotifyConnection() {
      // On page load try to fetch auth code from current browser URL
      const args = new URLSearchParams(window.location.search);
      const code = args.get("code");
      const testLocalToken = localStorage.getItem("access_token");

      // If code is found, we're in a callback, do a token exchange (once)
      if (code && callBack && !expired) {
        const token = await getToken(code);
        setCurrentToken(token);
        console.log(token);
        setCallback(false);

        localStorage.setItem("access_token", token.access_token);
        localStorage.setItem("refresh_token", token.refresh_token);
        localStorage.setItem("expires_in", token.expires_in);

        const now = new Date();
        const expiry = new Date(now.getTime() + token.expires_in * 1000);
        localStorage.setItem("expires", expiry);
        setExpiration(expiry);

        // Remove code from URL so we can refresh correctly
        const url = new URL(window.location.href);
        url.searchParams.delete("code");

        const updatedUrl = url.search ? url.href : url.href.replace("?", "");
        window.history.replaceState({}, document.title, updatedUrl);
      }
    }

    testSpotifyConnection();
  }, [expired]);

  useEffect(() => {
    testLoggedIn();
    testExpiration();
  }, [currentToken]);

  async function redirectToSpotifyAuthorize() {
    const possible =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    const randomValues = crypto.getRandomValues(new Uint8Array(64));
    const randomString = randomValues.reduce(
      (acc, x) => acc + possible[x % possible.length],
      ""
    );

    const code_verifier = randomString;
    const data = new TextEncoder().encode(code_verifier);
    const hashed = await crypto.subtle.digest("SHA-256", data);

    const code_challenge_base64 = btoa(
      String.fromCharCode(...new Uint8Array(hashed))
    )
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

    window.localStorage.setItem("code_verifier", code_verifier);

    const authUrl = new URL(authorizationEndpoint);
    const params = {
      response_type: "code",
      client_id: clientId,
      scope: scope,
      code_challenge_method: "S256",
      code_challenge: code_challenge_base64,
      redirect_uri: redirectUrl,
    };

    authUrl.search = new URLSearchParams(params).toString();
    window.location.href = authUrl.toString(); // Redirect the user to the authorization server for login
  }

  async function getToken(code) {
    const code_verifier = localStorage.getItem("code_verifier");

    const response = await fetch(tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId,
        grant_type: "authorization_code",
        code: code,
        redirect_uri: redirectUrl,
        code_verifier: code_verifier,
      }),
    });

    return await response.json();
  }

  async function refreshToken() {
    const response = await fetch(tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId,
        grant_type: "refresh_token",
        refresh_token: currentToken.refresh_token,
      }),
    });

    return await response.json();
  }

  async function getUserData() {
    const response = await fetch("https://api.spotify.com/v1/me", {
      method: "GET",
      headers: { Authorization: "Bearer " + currentToken.access_token },
    });

    return await response.json();
  }

  // Click handlers
  async function loginWithSpotifyClick() {
    await redirectToSpotifyAuthorize();
  }

  async function logoutClick() {
    localStorage.clear();
    window.location.href = redirectUrl;
  }

  async function refreshTokenClick() {
    const token = await refreshToken();
    console.log(token);
    if (!token.error) {
      setCurrentToken(token);
      localStorage.setItem("access_token", token.access_token);
      localStorage.setItem("refresh_token", token.refresh_token);
      localStorage.setItem("expires_in", token.expires_in);

      const now = new Date();
      const expiry = new Date(now.getTime() + token.expires_in * 1000);
      localStorage.setItem("expires", expiry);
      setExpiration(expiry);
    }

    setExpired(false);
  }

  // If we have a token, we're logged in, so fetch user data and render logged in template
  // Logic for testing what to display
  async function testLoggedIn() {
    if (currentToken) {
      try {
        // console.log(currentToken);
        const usersData = await getUserData();
        setUserData(usersData);
        setLoading(false);
      } catch (e) {
        setError(error);
        setLoading(false);
      }
    }
  }

  async function testExpiration() {
    const testDate = (expires) => {
      const now = new Date().getTime();

      const expiredTest = now >= expires;
      if (expiredTest) {
        setExpired(true);
        setLoading(false);
        return true;
      }
      return false;
    };

    if (expiration) {
      const expires = Date.parse(expiration);
      return testDate(expires);
    } else if (localStorage.getItem("expires")) {
      const expires = Date.parse(localStorage.getItem("expires"));
      return testDate(expires);
    }
  }

  // If everything is retrieved successfully
  if (userData && !userData.error && !expired) {
    if (!userData.error) {
      return (
        <div>
          <h1>Hello</h1>
          <button onClick={logoutClick}>Log Out</button>
        </div>
      );
    } else {
      return (
        <div>
          <h1>{userData.error.message}</h1>
        </div>
      );
    }
  }

  // If no token exists in our state
  if (!currentToken) {
    return <button onClick={loginWithSpotifyClick}>Log in</button>;
  }

  // If our token is expired
  if (expired) {
    return (
      <div>
        <h1>Expired</h1>
        <button onClick={refreshTokenClick}>Refresh token</button>
      </div>
    );
  }

  // If content is loading
  if (loading) {
    return <h1>loading...</h1>;
  }
}

export default App;
